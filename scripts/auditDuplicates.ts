/**
 * READ-ONLY duplicate audit for the dedupe pipeline — makes NO database
 * changes. Writes scripts/dedupe-report.json and prints a summary.
 *
 * Usage: pnpm db:audit-duplicates
 *
 * Real duplicates are the same physical card recorded twice — typically an
 * old-API id vs its new-API (TCGdex) id. Consolidation favours the TCGdex
 * row (the API keeps updating it); `imageCompensation` losers have their
 * imageKey/imagesOptimized copied onto the keeper before deletion.
 *
 * Findings (review before acting):
 *   Class 1a — same set + name, zero-notation number collision ("086"/"86"):
 *              MERGE into one card, 301 the loser. When the API resolves
 *              the pair, its zero-padded `localId` form wins.
 *   Class 1b — same name + number across TCGdex "shadow sets" (e.g.
 *              /cards/2011bw-12 == /cards/mcd11-12):
 *              MERGE into the canonical set's card, 301 the loser.
 *              IMPORTANT: shadow cards may hold images TCGdex lacks — the
 *              merge must copy imageKey/imagesOptimized onto the keeper
 *              before deleting (see `imageCompensation` in each group).
 *   Class 2  — same set + name, "No Logo"/"No Symbol" printings with their
 *              OWN printed numbers (e.g. SVE #8 vs #16): DISTINCT cards,
 *              not duplicates. No merge, no redirect, no canonical/sitemap
 *              changes — recorded as `same-name-distinct-cards` only.
 *
 * Keepers are PROPOSED by `chooseKeeper` (live TCGdex id first — see
 * scripts/lib/duplicateDetection.ts) and executed by `pnpm db:apply-merges`
 * (dry-run first). The report carries ready-to-paste redirect entries.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import TCGdex from '@tcgdex/sdk';
import { PrismaClient } from '../prisma/generated/client';
import {
    DuplicateIndex,
    MiniCard,
    MiniSet,
    chooseKeeper,
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
    proposedAction: 'merge';
    name: string;
    number: string;
    members: CardDetail[];
    proposedKeeperId: string;
    rationale: string;
    /** Members whose imageKey/imagesOptimized must be copied to the keeper first */
    imageCompensation: string[];
}

interface DistinctGroup {
    reason: 'same-name-distinct-cards';
    proposedAction: 'none';
    setId: string;
    setName: string;
    name: string;
    members: CardDetail[];
    note: string;
}

const tcgdex = new TCGdex('en');

interface SetLiveness {
    exists: boolean;
    cardIds: Set<string>;
}

const setLivenessCache = new Map<string, Promise<SetLiveness>>();

/** Card ids the LIVE TCGdex API lists for `setId` (empty when the set is gone). */
function loadSetLiveness(setId: string): Promise<SetLiveness> {
    let cached = setLivenessCache.get(setId);
    if (!cached) {
        cached = (async () => {
            try {
                const set = await tcgdex.fetch('sets', setId);
                if (!set) return { exists: false, cardIds: new Set<string>() };
                const cardIds = new Set<string>();
                for (const ref of set.cards ?? []) cardIds.add(ref.id);
                return { exists: true, cardIds };
            } catch {
                return { exists: false, cardIds: new Set<string>() };
            }
        })();
        setLivenessCache.set(setId, cached);
    }
    return cached;
}

/** Subset of `members` whose ids are live in the TCGdex set listings (API-canonical). */
async function liveIdsFor(members: CardDetail[]): Promise<Set<string>> {
    const live = new Set<string>();
    for (const m of members) {
        const liveness = await loadSetLiveness(m.setId);
        if (liveness.cardIds.has(m.id)) live.add(m.id);
    }
    return live;
}

function rankMembers(members: CardDetail[], liveIds: Set<string>): { keeper: CardDetail; rationale: string } {
    const { winner, rationale } = chooseKeeper(
        members.map((m) => ({
            id: m.id,
            number: m.number,
            isLive: liveIds.has(m.id),
            isNative: isNativeId(m),
            hasImage: !!m.imageKey,
            hasPrice: m.hasMarketStats || m.priceHistoryCount > 0,
            setTotal: m.setTotal
        }))
    );
    return { keeper: members.find((m) => m.id === winner.id)!, rationale };
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
    // printings and stay in Class 2 below (no action).
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
        const { keeper, rationale } = rankMembers(members, await liveIdsFor(members));
        for (const m of members) if (m.id !== keeper.id) mergedAway.add(m.id);
        class1a.push({
            reason,
            proposedAction: 'merge',
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
        const { keeper, rationale } = rankMembers(shadowLinked, await liveIdsFor(shadowLinked));
        class1b.push({
            reason: 'shadow-set',
            proposedAction: 'merge',
            name: shadowLinked[0].name,
            number: shadowLinked[0].number,
            members: shadowLinked,
            proposedKeeperId: keeper.id,
            rationale,
            imageCompensation: imageCompensationFor(shadowLinked, keeper.id)
        });
    }

    // ---- Class 2: same name, different identity (e.g. "No Logo" printings) ----
    // Same set + name where one printing carries the no-logo rarity class and
    // another a real rarity — but DIFFERENT printed numbers (verified e.g.
    // SVE "No Logo" cards #8 vs #16): DISTINCT cards, NOT duplicates. No
    // merge, no redirect, no canonical/sitemap changes — review-only.
    const class2: DistinctGroup[] = [];
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
        const hasNoneish = members.some((m) => rarityClass(m.rarity) === 'noneish');
        const hasReal = members.some((m) => rarityClass(m.rarity) === 'real');
        if (!hasNoneish || !hasReal) continue;
        const numbersDistinct = new Set(members.map((m) => m.number.trim().toLowerCase())).size > 1;
        class2.push({
            reason: 'same-name-distinct-cards',
            proposedAction: 'none',
            setId: members[0].setId,
            setName: members[0].setName,
            name: members[0].name,
            members,
            note: numbersDistinct
                ? 'Different printed numbers => distinct cards (variant printings). Keep all live; no action.'
                : 'Same number but different rarity classes — not auto-merged; no action (verify manually if suspected duplicate).'
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

    // ---- Shadow-pair set summary: which copy has zero images, which is API-live ----
    const shadowSetSummary = await Promise.all(
        [...index.shadowPairs].map(async (key) => {
            const [a, b] = key.split('\u0000');
            const statFor = async (setId: string) => {
                const set = index.sets.get(setId)!;
                const liveness = await loadSetLiveness(setId);
                const cards = details.filter((c) => c.setId === setId);
                let absorbs = 0;
                let mergesInto = 0;
                for (const group of class1b) {
                    for (const member of group.members) {
                        if (member.setId !== setId) continue;
                        if (member.id === group.proposedKeeperId) absorbs++;
                        else mergesInto++;
                    }
                }
                return {
                    id: set.id,
                    name: set.name,
                    dbCardCount: cards.length,
                    cardsWithoutImages: cards.filter((c) => !c.imageKey).length,
                    apiLive: liveness.exists,
                    apiCardCount: liveness.cardIds.size,
                    absorbsFromOtherSet: absorbs,
                    mergesIntoOtherSet: mergesInto
                };
            };
            return {
                pair: [await statFor(a), await statFor(b)],
                setRedirect: setRedirects.find((r) => r.source === `/sets/${a}` || r.source === `/sets/${b}`) ?? null
            };
        })
    );

    const mergeGroups = [...class1a, ...class1b];
    const report = {
        generatedAt: new Date().toISOString(),
        summary: {
            setsScanned: rawSets.length,
            cardsScanned: details.length,
            shadowSetPairs: index.shadowPairs.size,
            class1aGroups: class1a.length,
            class1bGroups: class1b.length,
            mergeGroupsTotal: mergeGroups.length,
            cardsToAbsorb: cardRedirects.length,
            imageCompensations: mergeGroups.reduce((n, g) => n + g.imageCompensation.length, 0),
            class2Groups: class2.length,
            class2Action: 'none (same-name-distinct-cards)'
        },
        class1a,
        class1b,
        class2,
        shadowSetSummary,
        suggestedRedirects: { cardRedirects, setRedirects }
    };

    writeFileSync('scripts/dedupe-report.json', JSON.stringify(report, null, 2));
    console.log(`\n✅ Wrote scripts/dedupe-report.json`);
    console.log(`   sets=${report.summary.setsScanned} cards=${report.summary.cardsScanned}`);
    console.log(`   shadow set pairs: ${report.summary.shadowSetPairs}`);
    console.log(`   class 1a (same-set merges):     ${report.summary.class1aGroups}`);
    console.log(`   class 1b (shadow-set merges):   ${report.summary.class1bGroups}`);
    console.log(`   → ${report.summary.mergeGroupsTotal} merge groups absorbing ${report.summary.cardsToAbsorb} pages (${report.summary.imageCompensations} image copies)`);
    console.log(`   class 2 (same-name-distinct):   ${report.summary.class2Groups} — NO action (distinct cards, not duplicates)`);
    for (const pair of shadowSetSummary) {
        const [x, y] = pair.pair;
        const fmt = (s: typeof x) =>
            `${s.id} (${s.dbCardCount} cards, ${s.cardsWithoutImages} w/o images, API ${s.apiLive ? `live/${s.apiCardCount} listed` : 'gone'}, absorbs ${s.absorbsFromOtherSet} / loses ${s.mergesIntoOtherSet})`;
        console.log(`   shadow pair: ${fmt(x)} ↔ ${fmt(y)}`);
    }
    console.log('\n➡️  Review the report, then run `pnpm db:apply-merges` (dry-run first).');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
