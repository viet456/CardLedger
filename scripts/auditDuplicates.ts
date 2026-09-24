/**
 * READ-ONLY duplicate audit for the dedupe pipeline — makes NO database
 * changes. Writes scripts/dedupe-report.json and prints a summary.
 *
 * Usage: pnpm db:audit-duplicates
 *
 * Findings (review before acting):
 *   Class 1a — same set + name, zero-notation number collision ("086"/"86"):
 *              MERGE into one card, 301 the loser.
 *   Class 1b — same name + number across TCGdex "shadow sets" (e.g.
 *              /cards/2011bw-12 == /cards/mcd11-12):
 *              MERGE into the canonical set's card, 301 the loser.
 *              IMPORTANT: shadow cards may hold images TCGdex lacks — the
 *              merge must copy imageKey/imagesOptimized onto the keeper
 *              before deleting (see `imageCompensation` in each group).
 *   Class 2  — same set + name, "No Logo"/"No Symbol" variant printing:
 *              KEEP LIVE, point its canonical at the main printing and
 *              exclude it from sitemaps (no redirect).
 *
 * Each group carries a PROPOSED keeper (human decides) and ready-to-paste
 * redirect entries for src/lib/cardRedirects.ts.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';
import {
    DuplicateIndex,
    MiniCard,
    MiniSet,
    isNativeId,
    rarityClass
} from './lib/duplicateDetection';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface CardDetail extends MiniCard {
    setName: string;
    rarity: string | null;
    imageKey: string | null;
    imagesOptimized: boolean;
    hasMarketStats: boolean;
    priceHistoryCount: number;
    collectionEntryCount: number;
    setTotal: number;
}

interface MergeGroup {
    reason: 'zero-notation' | 'migration-leftover' | 'identical-duplicate' | 'shadow-set';
    name: string;
    number: string;
    members: CardDetail[];
    proposedKeeperId: string;
    rationale: string;
    /** Members whose imageKey/imagesOptimized must be copied to the keeper first */
    imageCompensation: string[];
}

interface VariantGroup {
    reason: 'no-logo-variant';
    setId: string;
    setName: string;
    name: string;
    members: CardDetail[];
    proposedCanonicalId: string;
    sitemapExcludeIds: string[];
}

function rankMembers(members: CardDetail[]): { keeper: CardDetail; rationale: string } {
    const sorted = [...members].sort((a, b) => {
        // 1. keep the NATIVE id ("{setId}-...") — migration leftovers go away
        const aNative = isNativeId(a);
        const bNative = isNativeId(b);
        if (aNative !== bNative) return aNative ? -1 : 1;
        // 2. keep the card that HAS an image (can absorb the other's later)
        if (!!a.imageKey !== !!b.imageKey) return a.imageKey ? -1 : 1;
        // 3. keep the card with price data (links/SEO value)
        const aPriced = a.hasMarketStats || a.priceHistoryCount > 0;
        const bPriced = b.hasMarketStats || b.priceHistoryCount > 0;
        if (aPriced !== bPriced) return aPriced ? -1 : 1;
        // 4. keep the one living in the bigger (fuller) set listing
        if (a.setTotal !== b.setTotal) return b.setTotal - a.setTotal;
        // 5. deterministic
        return a.id < b.id ? -1 : 1;
    });
    const keeper = sorted[0];
    const factors: string[] = [];
    if (isNativeId(keeper)) factors.push('native set id');
    if (keeper.imageKey) factors.push('has image');
    if (keeper.hasMarketStats || keeper.priceHistoryCount > 0) factors.push('has price data');
    factors.push(`larger set listing (${keeper.setTotal} cards)`);
    return { keeper, rationale: `proposal: ${factors.join(', ')}; verify manually` };
}

function imageCompensationFor(members: CardDetail[], keeperId: string): string[] {
    const keeper = members.find((m) => m.id === keeperId)!;
    return members
        .filter((m) => m.id !== keeperId && m.imageKey && !keeper.imageKey)
        .map((m) => m.id);
}

async function main() {
    console.log('🔎 Auditing duplicate card pages (read-only)...');

    const rawSets = await prisma.set.findMany({
        select: {
            id: true,
            name: true,
            releaseDate: true,
            printedTotal: true,
            total: true,
            cards: {
                select: {
                    id: true,
                    name: true,
                    number: true,
                    setId: true,
                    imageKey: true,
                    imagesOptimized: true,
                    rarity: { select: { name: true } },
                    marketStats: { select: { tcgNearMintLatest: true } },
                    _count: { select: { priceHistory: true, inCollections: true } }
                }
            }
        }
    });

    const miniSets: MiniSet[] = rawSets.map((s) => ({
        id: s.id,
        name: s.name,
        releaseDate: s.releaseDate,
        printedTotal: s.printedTotal,
        total: s.total
    }));
    const details: CardDetail[] = [];
    for (const set of rawSets) {
        for (const card of set.cards) {
            details.push({
                id: card.id,
                name: card.name,
                number: card.number,
                setId: card.setId,
                setName: set.name,
                rarity: card.rarity?.name ?? null,
                imageKey: card.imageKey,
                imagesOptimized: card.imagesOptimized,
                hasMarketStats: !!card.marketStats,
                priceHistoryCount: card._count.priceHistory,
                collectionEntryCount: card._count.inCollections,
                setTotal: set.total
            });
        }
    }
    const index = new DuplicateIndex(details, miniSets);

    // ---- Class 1: same set + name + normalized number -> MERGE + 301 ----
    // Only when all members share a rarity class — groups spanning the
    // "No Logo" (None/null) and real-rarity classes may be distinct variant
    // printings and are routed to the Class 2 review below instead.
    const class1a: MergeGroup[] = [];
    const mergedAway = new Set<string>();
    for (const [, cards] of index.bySetNormNumber) {
        const ids = new Set(cards.map((c) => c.id));
        if (ids.size <= 1) continue;
        const members = cards as CardDetail[];
        const classes = new Set(members.map((m) => rarityClass(m.rarity)));
        if (classes.size > 1) continue; // -> Class 2 review
        const rawNumbers = new Set(members.map((m) => m.number.trim().toLowerCase()));
        const reason: MergeGroup['reason'] =
            rawNumbers.size > 1
                ? 'zero-notation'
                : members.some((m) => !isNativeId(m))
                  ? 'migration-leftover'
                  : 'identical-duplicate';
        const { keeper, rationale } = rankMembers(members);
        for (const m of members) if (m.id !== keeper.id) mergedAway.add(m.id);
        class1a.push({
            reason,
            name: members[0].name,
            number: members.map((m) => m.number).join(' / '),
            members,
            proposedKeeperId: keeper.id,
            rationale,
            imageCompensation: imageCompensationFor(members, keeper.id)
        });
    }

    // ---- Class 1b: same physical card across shadow sets ----
    const class1b: MergeGroup[] = [];
    for (const [, cards] of index.byNameNumber) {
        const setIds = [...new Set(cards.map((c) => c.setId))];
        if (setIds.length <= 1) continue;
        const shadowLinked = [
            ...new Map(
                cards
                    .filter((candidate) =>
                        cards.some(
                            (other) =>
                                other.id !== candidate.id &&
                                index.areShadows(candidate.setId, other.setId)
                        )
                    )
                    .map((c) => [c.id, c])
            ).values()
        ] as CardDetail[];
        const uniqueSets = [...new Set(shadowLinked.map((c) => c.setId))];
        if (shadowLinked.length <= 1 || uniqueSets.length <= 1) continue;
        const { keeper, rationale } = rankMembers(shadowLinked);
        class1b.push({
            reason: 'shadow-set',
            name: shadowLinked[0].name,
            number: shadowLinked[0].number,
            members: shadowLinked,
            proposedKeeperId: keeper.id,
            rationale,
            imageCompensation: imageCompensationFor(shadowLinked, keeper.id)
        });
    }

    // ---- Class 2: "No Logo" (rarity None/null) variant printings ----
    // Same set + name where one printing carries the no-logo rarity class and
    // another a real rarity: distinct printings — KEEP LIVE, point the
    // variant's canonical at the main printing and exclude it from sitemaps.
    const class2: VariantGroup[] = [];
    const bySetName = new Map<string, CardDetail[]>();
    for (const card of details) {
        const key = `${card.setId}\u0000${card.name.trim().toLowerCase()}`;
        const list = bySetName.get(key) ?? [];
        list.push(card);
        bySetName.set(key, list);
    }
    for (const [, allMembers] of bySetName) {
        // ignore members already merged away by Class 1
        const members = allMembers.filter((m) => !mergedAway.has(m.id));
        if (members.length <= 1) continue;
        const noneish = members.filter((m) => rarityClass(m.rarity) === 'noneish');
        const real = members.filter((m) => rarityClass(m.rarity) === 'real');
        if (noneish.length === 0 || real.length === 0) continue;
        // canonical = the best real-rarity printing
        const canonical = rankMembers(real).keeper;
        class2.push({
            reason: 'no-logo-variant',
            setId: members[0].setId,
            setName: members[0].setName,
            name: members[0].name,
            members,
            proposedCanonicalId: canonical.id,
            sitemapExcludeIds: noneish.map((m) => m.id)
        });
    }

    // ---- Ready-to-paste redirects (used after merges are approved/executed) ----
    const cardRedirects: { source: string; destination: string; note: string }[] = [];
    const absorbedCount = new Map<string, number>();
    for (const group of [...class1a, ...class1b]) {
        for (const member of group.members) {
            if (member.id === group.proposedKeeperId) continue;
            cardRedirects.push({
                source: `/cards/${member.id}`,
                destination: `/cards/${group.proposedKeeperId}`,
                note: group.reason
            });
            absorbedCount.set(member.setId, (absorbedCount.get(member.setId) ?? 0) + 1);
        }
    }

    // Whole-set redirects for shadow sets that get fully absorbed
    const setRedirects: { source: string; destination: string; note: string }[] = [];
    const handled = new Set<string>();
    for (const key of index.shadowPairs) {
        const [a, b] = key.split('\u0000');
        const setA = index.sets.get(a)!;
        const setB = index.sets.get(b)!;
        // the fuller set survives; the loser redirects when fully absorbed
        const [keeperSet, loserSet] = setA.total >= setB.total ? [setA, setB] : [setB, setA];
        const loserCards = details.filter((c) => c.setId === loserSet.id).length;
        const duped = absorbedCount.get(loserSet.id) ?? 0;
        if (loserCards > 0 && duped / loserCards >= 0.9 && !handled.has(loserSet.id)) {
            handled.add(loserSet.id);
            setRedirects.push({
                source: `/sets/${loserSet.id}`,
                destination: `/sets/${keeperSet.id}`,
                note: 'shadow-set fully absorbed'
            });
        }
    }

    const report = {
        generatedAt: new Date().toISOString(),
        summary: {
            setsScanned: rawSets.length,
            cardsScanned: details.length,
            shadowSetPairs: index.shadowPairs.size,
            class1aGroups: class1a.length,
            class1bGroups: class1b.length,
            class2Groups: class2.length
        },
        class1a,
        class1b,
        class2,
        suggestedRedirects: { cardRedirects, setRedirects }
    };

    writeFileSync('scripts/dedupe-report.json', JSON.stringify(report, null, 2));
    console.log(`\n✅ Wrote scripts/dedupe-report.json`);
    console.log(`   sets=${report.summary.setsScanned} cards=${report.summary.cardsScanned}`);
    console.log(`   shadow set pairs: ${report.summary.shadowSetPairs}`);
    console.log(`   class 1  (same-set merges):      ${report.summary.class1aGroups} (zero-notation + migration leftovers)`);
    console.log(`   class 1b (shadow-set merges):    ${report.summary.class1bGroups}`);
    console.log(`   class 2  (No Logo variants):     ${report.summary.class2Groups} (keep live, canonical + sitemap exclude)`);
    console.log('\n➡️  Review the report, then execute merges + fill src/lib/cardRedirects.ts.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
