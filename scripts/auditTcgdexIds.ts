/**
 * Audit Card.id provenance against the TCGdex API and check the redirect graph.
 *
 * Card ids must be current TCGdex ids — TCGdex is the naming authority and
 * canonical, OG and sitemap URLs all embed Card.id. Rows created before the id
 * migration can carry pre-migration (pokemontcg-era) ids that TCGdex does not
 * know, e.g. the cel25-XXA shells that duplicated the cel25cc-CC0xx Classic
 * Collection keepers (found 2026-09; merged under commit 5a13a6a).
 *
 * Usage: pnpm run db:audit-ids
 *
 * Reports:
 *   1. suspects — Card rows whose id is unknown to TCGdex (with keeper suggestions)
 *   2. gaps     — TCGdex cards with no Card row (new cards or id renames)
 *   3. redirect graph — duplicate sources, self-loops, chains, cross-type pairs,
 *      destinations missing from the DB, sources shadowing live rows
 *
 * Exits 1 when suspects or redirect-graph problems are found; gaps are
 * informational (a plain db:populate run may lag the API).
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';
import TCGdex from '@tcgdex/sdk';
import pLimit from 'p-limit';
import { cardRedirects, setRedirects } from '../src/lib/cardRedirects';

interface TcgdexCardRef {
    id: string;
    name?: string;
    localId?: string;
}

interface TcgdexSetDetails {
    id: string;
    name: string;
    cards?: TcgdexCardRef[];
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const tcgdex = new TCGdex('en');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
    const retries = 5;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (e: any) {
            const msg = e?.message || '';
            const isRetryable =
                msg.includes('invalid error') ||
                msg.includes('500') ||
                msg.includes('502') ||
                msg.includes('503');
            if (isRetryable && attempt < retries) {
                const delay = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s, 16s, 32s
                console.warn(
                    `\n  ⏳ Retry ${attempt + 1}/${retries} for ${label} in ${delay}ms...`
                );
                await sleep(delay);
                continue;
            }
            throw e;
        }
    }
    throw new Error(`withRetry: exhausted retries for ${label}`);
}

/** 'Umbreon ☆' and 'Umbreon Star' normalize to the same key. */
function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .replace(/☆/g, 'star')
        .replace(/[^a-z0-9]+/g, '');
}

function typeOf(path: string): string {
    if (path.startsWith('/cards/')) return 'card';
    if (path.startsWith('/sets/')) return 'set';
    return 'other';
}

function idOf(path: string): string {
    // redirect paths carry URL-encoded ids (sitemaps.ts convention)
    return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1));
}

async function main() {
    console.log('🔎 Auditing card id provenance against TCGdex...\n');

    const dbSets = await prisma.set.findMany({
        select: { id: true, name: true, tcgdexId: true },
        orderBy: { id: 'asc' }
    });
    const dbCards = await prisma.card.findMany({
        select: { id: true, name: true, number: true, setId: true },
        orderBy: { id: 'asc' }
    });
    const dbCardIds = new Set(dbCards.map((c) => c.id));
    const dbSetIds = new Set(dbSets.map((s) => s.id));

    // --- 1. Fetch the current TCGdex id space (one listing per DB set) ---
    const limit = pLimit(6);
    const listingIds = new Map<string, Set<string>>(); // DB setId -> tcgdex card ids
    const tcgdexName = new Map<string, string>(); // tcgdex card id -> name
    const tcgdexLocal = new Map<string, string>(); // tcgdex card id -> printed number (localId)
    const failedSets = new Set<string>();
    let fetched = 0;

    await Promise.all(
        dbSets.map((s) =>
            limit(async () => {
                if (!s.tcgdexId) {
                    failedSets.add(s.id);
                    console.warn(`  ⚠️ ${s.id}: no tcgdexId stored — cannot verify its cards`);
                    return;
                }
                try {
                    const full = (await withRetry(
                        () => tcgdex.fetch('sets', s.tcgdexId!),
                        `sets/${s.tcgdexId}`
                    )) as unknown as TcgdexSetDetails | null;
                    if (!full?.cards) {
                        failedSets.add(s.id);
                        console.warn(`  ⚠️ ${s.id}: TCGdex returned no listing for ${s.tcgdexId}`);
                        return;
                    }
                    const ids = new Set<string>();
                    for (const c of full.cards) {
                        ids.add(c.id);
                        if (c.name) tcgdexName.set(c.id, c.name);
                        if (c.localId) tcgdexLocal.set(c.id, c.localId);
                    }
                    listingIds.set(s.id, ids);
                    fetched++;
                } catch (e: any) {
                    failedSets.add(s.id);
                    console.warn(`  ⚠️ ${s.id}: fetch failed (${e?.message || e})`);
                }
            })
        )
    );

    const tcgdexIds = new Set<string>();
    for (const ids of listingIds.values()) for (const id of ids) tcgdexIds.add(id);

    console.log(
        `\n📊 DB: ${dbCards.length} cards / ${dbSets.length} sets | TCGdex: ${fetched} set listings (${tcgdexIds.size} cards)`
    );

    // --- 2. Suspects + gaps ---
    // Set-listing membership is the fast filter; a candidate is only a real
    // suspect once GET /cards/{id} confirms TCGdex does not know the id.
    const probeCard = async (id: string): Promise<boolean> => {
        for (let attempt = 0; attempt <= 2; attempt++) {
            try {
                const card = (await tcgdex.fetch('cards', id)) as unknown as { id: string } | null;
                return Boolean(card?.id);
            } catch (e: any) {
                const msg = e?.message || '';
                const transient = msg.includes('500') || msg.includes('502') || msg.includes('503');
                if (!transient || attempt === 2) return false;
                await sleep(1000 * Math.pow(2, attempt));
            }
        }
        return false;
    };

    const candidates = dbCards.filter((c) => !failedSets.has(c.setId) && !tcgdexIds.has(c.id));
    const suspects: typeof dbCards = [];
    const offListing: typeof dbCards = []; // real tcgdex ids that just aren't in their set's listing
    await Promise.all(
        candidates.map((c) =>
            limit(async () => {
                if (await probeCard(c.id)) offListing.push(c);
                else suspects.push(c);
            })
        )
    );
    suspects.sort((a, b) => a.id.localeCompare(b.id));

    const gaps: string[] = [];
    for (const id of tcgdexIds) if (!dbCardIds.has(id)) gaps.push(id);

    if (offListing.length > 0) {
        console.log(
            `\nℹ️ ${offListing.length} id(s) absent from their set's listing but real in TCGdex (not suspects).`
        );
    }

    if (suspects.length === 0) {
        console.log('\n✅ No suspect ids — every Card row is a current TCGdex id.');
    } else {
        console.log(`\n🚨 Suspect ids (in the DB, unknown to TCGdex) — ${suspects.length}:`);
        const pairLines: string[] = [];
        const gapSet = new Set(gaps);
        const normalizeNum = (n: string) =>
            n
                .toLowerCase()
                .replace(/[^0-9a-z]/g, '')
                .replace(/0+(\d)/g, '$1');
        // Printed-number key: zero-padding and one trailing variant suffix are
        // insignificant ("H1" == "H01", "157a" == "157", "BW004" == "BW04").
        const numKey = (n: string) => normalizeNum(n).replace(/[ab]$/, '');
        const plausibleName = (a: string, b: string) => {
            const na = normalizeName(a).replace(/^basic/, '');
            const nb = normalizeName(b).replace(/^basic/, '');
            return na === nb || na.includes(nb) || nb.includes(na);
        };
        for (const c of suspects) {
            // Keeper heuristic (within the set's current TCGdex listing):
            //  - same printed-number key, scored by rename-target (gap id) + plausible name
            //  - exact-name fallback when the number format changed entirely
            // Rows without a convincing match are flagged for review by hand —
            // same-name distinct cards must never be guessed.
            const listing = [...(listingIds.get(c.setId) ?? [])];
            const key = numKey(c.number ?? '');
            let candidates = key
                ? listing.filter((id) => numKey(tcgdexLocal.get(id) ?? '') === key)
                : [];
            let suggestion: string | undefined;
            if (candidates.length) {
                const scored = candidates.map((id) => ({
                    id,
                    score:
                        (gapSet.has(id) ? 3 : 0) +
                        (plausibleName(c.name, tcgdexName.get(id) ?? '') ? 2 : 0)
                }));
                scored.sort((a, b) => b.score - a.score);
                if (
                    scored[0].score >= 2 &&
                    (scored.length === 1 || scored[0].score > scored[1].score)
                ) {
                    suggestion = scored[0].id;
                } else {
                    candidates = scored.map((s) => s.id);
                }
            } else {
                candidates = listing.filter(
                    (id) => normalizeName(tcgdexName.get(id) ?? '') === normalizeName(c.name)
                );
                if (candidates.length === 1) suggestion = candidates[0];
            }
            const label = suggestion
                ? `-> merge into ${suggestion} "${tcgdexName.get(suggestion)}"`
                : `-> review by hand${candidates.length ? ` (candidates: ${candidates.join(', ')})` : ''}`;
            console.log(`   ${c.id} (${c.setId}) "${c.name}" #${c.number}  ${label}`);
            if (suggestion)
                pairLines.push(
                    `    { source: '/cards/${c.id}', destination: '/cards/${suggestion}' },`
                );
        }
        if (pairLines.length) {
            console.log('\n   Suggested pairs for src/lib/cardRedirects.ts:');
            console.log(pairLines.join('\n'));
        }
    }

    if (gaps.length === 0) {
        console.log('\n✅ No gaps — every TCGdex card has a Card row.');
    } else {
        console.log(`\nℹ️ Gap ids (in TCGdex, missing from the DB) — ${gaps.length}:`);
        for (const id of [...gaps].sort()) console.log(`   ${id} "${tcgdexName.get(id)}"`);
    }

    // --- 3. Redirect graph integrity (reads the real arrays — no fragile parsing) ---
    const problems: string[] = [];
    const all = [...cardRedirects, ...setRedirects];

    const sources = new Map<string, number>();
    const destinations = new Set<string>();
    for (const r of all) {
        sources.set(r.source, (sources.get(r.source) ?? 0) + 1);
        destinations.add(r.destination);
    }
    for (const [src, n] of sources) if (n > 1) problems.push(`duplicate source ${src} (${n}x)`);

    for (const r of all) {
        if (r.source === r.destination) problems.push(`self-loop ${r.source}`);
        if (typeOf(r.source) !== typeOf(r.destination))
            problems.push(`cross-type ${r.source} -> ${r.destination}`);
        if (destinations.has(r.source))
            problems.push(
                `chain ${r.source} -> ${r.destination} (source is another pair's destination)`
            );
        if (r.destination.startsWith('/cards/') && !dbCardIds.has(idOf(r.destination)))
            problems.push(`missing card keeper ${r.destination}`);
        if (r.destination.startsWith('/sets/') && !dbSetIds.has(idOf(r.destination)))
            problems.push(`missing set keeper ${r.destination}`);
        if (r.source.startsWith('/cards/') && dbCardIds.has(idOf(r.source)))
            problems.push(`shadowed card source ${r.source} (still live in the DB)`);
        if (r.source.startsWith('/sets/') && dbSetIds.has(idOf(r.source)))
            problems.push(`shadowed set source ${r.source} (still live in the DB)`);
    }

    if (problems.length === 0) {
        console.log(
            `\n🧭 Redirect graph clean — ${all.length} pairs (${cardRedirects.length} card + ${setRedirects.length} set): no dups, self-loops, chains or cross-type pairs; all keepers exist; no shadowed sources.`
        );
    } else {
        console.log(`\n🧭 Redirect graph problems — ${problems.length}:`);
        for (const p of problems) console.log(`   ${p}`);
    }

    if (suspects.length > 0 || problems.length > 0) {
        console.log(
            `\n❌ Audit failed: ${suspects.length} suspect id(s), ${problems.length} redirect problem(s).`
        );
        process.exitCode = 1;
    } else {
        console.log('\n✅ Audit passed.');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(async () => await prisma.$disconnect());
