/**
 * READ-ONLY set-merge audit for the set-consolidation pipeline — makes NO
 * database changes. Writes scripts/set-merge-report.json and prints a summary.
 *
 * Usage: pnpm db:audit-set-merges
 *
 * Duplicate set shells = the same physical product recorded under two set ids
 * (typically a dead-API slug vs its live TCGdex id: swsh12pt5gg vs swsh12.5gg).
 * TCGdex is the source of truth for set identity; R2 is the source of truth
 * for set logo/symbol images (the API often lacks subset logos, so a "loser"
 * shell may hold the only image).
 *
 * Detection (scripts/lib/duplicateDetection.ts):
 *   - `groupDuplicateSets`: name twins + shells linked by existing card
 *     redirects (fut20 -> fut2020). Keeps the live TCGdex set
 *     (`chooseSetKeeper`). BLOCKED for manual review (never auto-merged) when
 *     0 or 2+ members are live in TCGdex, or a loser holds cards whose names
 *     don't name-pair with keeper cards (card-level dedupe already merged
 *     what matched; anything left is an unmerged cross-shell product).
 *   - `findSignatureOnlyPairs` (flag-only): same print signature with
 *     different names — the tk-xy trainer-kit tail. Distinct products;
 *     recorded for `pnpm db:lint-cards`, never merged.
 *
 * Proposed merges:
 *   1. move the loser's cards onto the keeper (rows travel intact — their
 *      imageKeys are the serving keys and must NOT be copied or rewritten);
 *   2. borrow the loser's logoImageKey/symbolImageKey strings when the keeper
 *      has none (key-string repoint only — never copy R2 objects);
 *   3. delete the empty loser (cards first — Card.set is onDelete: Restrict)
 *      and bump the keeper's updatedAt for a real sitemap lastmod;
 *   4. 301 /sets/{loser} -> /sets/{keeper}.
 *
 * Findings feed `pnpm db:apply-set-merges` (dry-run first). The report carries
 * ready-to-paste redirect entries.
 */
import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import TCGdex from '@tcgdex/sdk';
import pLimit from 'p-limit';
import { PrismaClient } from '../prisma/generated/client';
import { cardRedirects } from '../src/lib/cardRedirects';
import {
    type DuplicateSetGroup,
    type MiniCard,
    type SetMergeCandidate,
    findSignatureOnlyPairs,
    groupDuplicateSets
} from './lib/duplicateDetection';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const tcgdex = new TCGdex('en');

interface SetDetail extends SetMergeCandidate {
    logoImageKey: string | null;
    symbolImageKey: string | null;
}

interface MemberReport {
    id: string;
    name: string;
    role: 'keeper' | 'loser';
    apiLive: boolean;
    releaseDate: string;
    printedTotal: number;
    total: number;
    cardCount: number;
    cardsWithImages: number;
    logoImageKey: string | null;
    symbolImageKey: string | null;
}

interface ImageBorrow {
    from: string;
    to: string;
    logoImageKey?: string;
    symbolImageKey?: string;
}

interface SetMergeGroupReport {
    reason: 'name' | 'redirects';
    proposedAction: 'merge' | 'none';
    /** Human-readable reasons this group must NOT be auto-merged (null = actionable). */
    blocked: string | null;
    proposedKeeperId: string;
    rationale: string;
    members: MemberReport[];
    cardsToMove: number;
    imageBorrow: ImageBorrow[];
}

/**
 * Which set ids the LIVE TCGdex API still lists — the API-canonical identity
 * the keeper rules rank on. Mirrors auditDuplicates' `loadSetLiveness`: an
 * unresolvable id counts as gone (that IS the signal), and every proposal
 * still ends in "verify manually" + a dry run.
 */
async function loadLiveness(setIds: string[]): Promise<Map<string, boolean>> {
    const limit = pLimit(6);
    const entries = await Promise.all(
        setIds.map((id) =>
            limit(async () => {
                const set = await tcgdex.fetch('sets', id).catch(() => undefined);
                return [id, Boolean(set)] as const;
            })
        )
    );
    return new Map(entries);
}

function memberReport(d: SetDetail, role: MemberReport['role']): MemberReport {
    return {
        id: d.id,
        name: d.name,
        role,
        apiLive: d.isLive,
        releaseDate: d.releaseDate ? d.releaseDate.toISOString().slice(0, 10) : 'unknown',
        printedTotal: d.printedTotal,
        total: d.total,
        cardCount: d.cards.length,
        cardsWithImages: d.cardsWithImages,
        logoImageKey: d.logoImageKey,
        symbolImageKey: d.symbolImageKey
    };
}

async function main() {
    const rawSets = await prisma.set.findMany({
        include: {
            cards: { select: { id: true, name: true, number: true, setId: true, rarity: true, imageKey: true } }
        },
        orderBy: { id: 'asc' }
    });

    const liveness = await loadLiveness(rawSets.map((s) => s.id));
    const liveCount = [...liveness.values()].filter(Boolean).length;
    console.log(`TCGdex liveness: ${liveCount}/${rawSets.length} sets still listed`);

    const details: SetDetail[] = rawSets.map((set) => {
        const cards: MiniCard[] = set.cards.map((c) => ({
            id: c.id,
            name: c.name,
            number: c.number,
            setId: c.setId,
            rarity: c.rarity?.name ?? null
        }));
        return {
            id: set.id,
            name: set.name,
            releaseDate: set.releaseDate,
            printedTotal: set.printedTotal,
            total: set.total,
            isLive: liveness.get(set.id) ?? false,
            cards,
            cardsWithImages: set.cards.filter((c) => c.imageKey !== null).length,
            hasLogo: set.logoImageKey !== null,
            hasSymbol: set.symbolImageKey !== null,
            logoImageKey: set.logoImageKey,
            symbolImageKey: set.symbolImageKey
        };
    });
    const detailById = new Map(details.map((d) => [d.id, d]));

    const groups = groupDuplicateSets(details, cardRedirects);
    const signatureOnlyPairs = findSignatureOnlyPairs(details);

    const reportGroups: SetMergeGroupReport[] = groups.map((group: DuplicateSetGroup) => {
        const keeperId = group.keeper!.winner.id;
        const keeper = detailById.get(keeperId)!;
        const losers = group.members.filter((m) => m.id !== keeperId).map((m) => detailById.get(m.id)!);
        // Borrow = repoint key strings onto a keeper lacking them. NEVER copy
        // R2 objects (precedent: 2011bw keeps serving sets/mcd11-logo.png).
        const imageBorrow: ImageBorrow[] = [];
        for (const loser of losers) {
            const borrow: ImageBorrow = { from: loser.id, to: keeperId };
            if (!keeper.logoImageKey && loser.logoImageKey) borrow.logoImageKey = loser.logoImageKey;
            if (!keeper.symbolImageKey && loser.symbolImageKey) borrow.symbolImageKey = loser.symbolImageKey;
            if (borrow.logoImageKey || borrow.symbolImageKey) imageBorrow.push(borrow);
        }
        return {
            reason: group.reason,
            proposedAction: group.blocked ? 'none' : 'merge',
            blocked: group.blocked,
            proposedKeeperId: keeperId,
            rationale: group.keeper!.rationale,
            members: [memberReport(keeper, 'keeper'), ...losers.map((l) => memberReport(l, 'loser'))],
            cardsToMove: losers.reduce((n, l) => n + l.cards.length, 0),
            imageBorrow
        };
    });

    const actionable = reportGroups.filter((g) => g.proposedAction === 'merge');
    const setRedirects = actionable.flatMap((g) =>
        g.members
            .filter((m) => m.role === 'loser')
            .map((m) => ({ source: `/sets/${m.id}`, destination: `/sets/${g.proposedKeeperId}` }))
    );
    const setsToAbsorb = setRedirects.length;

    const report = {
        generatedAt: new Date().toISOString(),
        summary: {
            setsScanned: rawSets.length,
            cardsScanned: details.reduce((n, d) => n + d.cards.length, 0),
            setsLiveInApi: liveCount,
            duplicateGroups: reportGroups.length,
            actionableGroups: actionable.length,
            blockedGroups: reportGroups.length - actionable.length,
            setsToAbsorb,
            cardsToMove: actionable.reduce((n, g) => n + g.cardsToMove, 0),
            imageBorrows: actionable.reduce((n, g) => n + g.imageBorrow.length, 0),
            signatureOnlyPairs: signatureOnlyPairs.length,
            signatureOnlyAction: 'none (distinct products — flag for pnpm db:lint-cards)',
            expectedSetCountAfter: rawSets.length - setsToAbsorb
        },
        groups: reportGroups,
        signatureOnlyPairs: signatureOnlyPairs.map(([a, b]) => ({
            a: { id: a.id, name: a.name, releaseDate: a.releaseDate?.toISOString().slice(0, 10) ?? null },
            b: { id: b.id, name: b.name, releaseDate: b.releaseDate?.toISOString().slice(0, 10) ?? null },
            note: 'same release date + printed/total counts — distinct products unless proven otherwise; never auto-merge'
        })),
        suggestedRedirects: { setRedirects }
    };

    writeFileSync('scripts/set-merge-report.json', JSON.stringify(report, null, 2));
    console.log(`\n✅ Wrote scripts/set-merge-report.json`);
    console.log(`   sets=${report.summary.setsScanned} cards=${report.summary.cardsScanned}`);
    console.log(
        `   duplicate set groups: ${report.summary.duplicateGroups} (actionable ${report.summary.actionableGroups}, blocked ${report.summary.blockedGroups})`
    );
    console.log(
        `   → would absorb ${report.summary.setsToAbsorb} shells, moving ${report.summary.cardsToMove} cards (${report.summary.imageBorrows} image borrows)`
    );
    console.log(`   set count ${report.summary.setsScanned} → ${report.summary.expectedSetCountAfter}`);
    for (const g of reportGroups) {
        const losers = g.members.filter((m) => m.role === 'loser').map((m) => m.id);
        const tag = g.proposedAction === 'merge' ? 'merge  ' : 'BLOCKED';
        console.log(`   ${tag} [${g.reason}] ${g.proposedKeeperId} <= ${losers.join(', ')}${g.blocked ? ` — ${g.blocked}` : ''}`);
    }
    if (report.summary.signatureOnlyPairs > 0) {
        console.log(`   flag-only signature twins: ${report.summary.signatureOnlyPairs} (see report)`);
    }
    console.log('\n➡️  Review the report, then run `pnpm db:apply-set-merges` (dry-run first).');
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());