/**
 * SET-CONSOLIDATION PIPELINE — STEP 2: execute the set merges proposed by the
 * read-only audit (scripts/set-merge-report.json). DRY RUN by default; --apply.
 *
 * For each actionable group (keeper = live TCGdex set, see
 * scripts/lib/duplicateDetection.ts):
 *   1. merges the loser's cards into their name-paired keeper twins — same
 *      mechanics as scripts/applyMerges.ts: imageKey/imagesOptimized
 *      compensation, CollectionEntry repoint (ALWAYS — the FK's onDelete:
 *      Cascade would otherwise destroy users' collections), MarketStats/
 *      PriceHistory repoint-or-drop, variant-flag OR, explicit child cleanup
 *      + delete;
 *   2. borrows the loser's logoImageKey/symbolImageKey strings onto a keeper
 *      lacking them (key-string repoint only — never copies R2 objects;
 *      precedent: 2011bw keeps serving sets/mcd11-logo.png);
 *   3. deletes the now-empty loser set (cards first — Card.set is
 *      onDelete: Restrict) and bumps set.updatedAt for a real sitemap lastmod.
 *
 * Prints ready-to-paste redirect pairs (card URLs + /sets/{loser} ->
 * /sets/{keeper}) for src/lib/cardRedirects.ts.
 *
 * Usage: pnpm db:apply-set-merges [--apply] [--only=<substring>]
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';
import { matchByNameBijection, type MiniCard } from './lib/duplicateDetection';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface ReportGroup {
    reason: string;
    proposedAction: 'merge' | 'none';
    proposedKeeperId: string;
    rationale: string;
    members: { id: string; name: string; role: 'keeper' | 'loser' }[];
}

interface SetMergeReport {
    generatedAt: string;
    groups: ReportGroup[];
}

const FLAGS = ['hasNormal', 'hasHolo', 'hasReverse', 'hasFirstEdition', 'hasWPromo'] as const;
type Flag = (typeof FLAGS)[number];

interface PairPlan {
    winnerId: string;
    loserId: string;
    collections: number;
    market: number;
    marketInWinner: number;
    history: number;
    historyInWinner: number;
    copyImage: boolean;
    dropImage: boolean;
    tcgPlayer: boolean;
    hasFlags: Flag[];
}

interface SetPlan {
    loserId: string;
    /** Key strings to borrow onto a keeper lacking them (null = nothing). */
    borrowLogo: string | null;
    borrowSymbol: string | null;
    borrowLogoOptimized: boolean;
    borrowSymbolOptimized: boolean;
}

const totals = {
    groupsMerged: 0,
    cardsMerged: 0,
    cardsSkipped: 0,
    setsDeleted: 0,
    imageBorrows: 0,
    imagesCopied: 0,
    collectionsRepointed: 0,
    marketRepointed: 0,
    historyRepointed: 0,
    historyDropped: 0
};
const redirectPairs: Array<{ source: string; destination: string }> = [];

/**
 * Merge one group: name-paired card merges (applyMerges mechanics) + set-level
 * image borrow and loser deletion. Returns false when the data no longer
 * matches the report (group skipped untouched — re-run the audit).
 */
async function main() {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');
    const onlyArg = args.find((a) => a.startsWith('--only='));
    const only = onlyArg?.slice('--only='.length).toLowerCase() ?? null;

    const report = JSON.parse(readFileSync('scripts/set-merge-report.json', 'utf8')) as SetMergeReport;
    const allGroups = report.groups.filter((g) => g.proposedAction === 'merge');
    const groups = allGroups.filter(
        (g) =>
            !only ||
            g.proposedKeeperId.toLowerCase().includes(only) ||
            g.members.some((m) => m.id.toLowerCase().includes(only) || m.name.toLowerCase().includes(only))
    );
    console.log(
        `${apply ? '🔧 APPLYING' : '🧪 DRY RUN'} ${groups.length}/${allGroups.length} set merges (report ${report.generatedAt})...`
    );

    for (const group of groups) {
        await mergeGroup(group, apply);
    }

    console.log(
        `\n${apply ? '✅ Merged' : '🧪 Dry run complete — no changes made.'} groups: ${totals.groupsMerged} ${apply ? 'executed' : 'would merge'}, ${totals.cardsSkipped} card(s) skipped`
    );
    console.log(
        `   sets deleted: ${totals.setsDeleted}, card merges: ${totals.cardsMerged}, collections repointed: ${totals.collectionsRepointed}, images copied: ${totals.imagesCopied}, image borrows: ${totals.imageBorrows}, market repointed: ${totals.marketRepointed}, history repointed: ${totals.historyRepointed}, history dropped: ${totals.historyDropped}`
    );
    console.log(`\n📋 Redirect pairs for src/lib/cardRedirects.ts (${redirectPairs.length}):`);
    for (const r of redirectPairs) console.log(`    { source: '${r.source}', destination: '${r.destination}' },`);
    if (apply) {
        console.log('\n➡️  Post-merge runbook:');
        console.log('   1. Splice the pairs above into src/lib/cardRedirects.ts (cardRedirects + setRedirects).');
        console.log('   2. pnpm typecheck && pnpm build.');
        console.log('   3. pnpm index:cards && pnpm index:market && pnpm index:history.');
        console.log('   4. Deploy, then purge the CDN for each source URL so the 301s go live.');
        console.log('   5. Google Search Console: resubmit sitemap.xml.');
    } else {
        console.log('\n➡️  Happy with the plan? Re-run with --apply.');
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());

async function mergeGroup(group: ReportGroup, apply: boolean): Promise<boolean> {
    const keeperId = group.proposedKeeperId;
    const loserIds = group.members.filter((m) => m.role === 'loser').map((m) => m.id);
    const rows = await prisma.card.findMany({
        where: { setId: { in: [keeperId, ...loserIds] } },
        select: {
            id: true,
            name: true,
            number: true,
            setId: true,
            imageKey: true,
            imagesOptimized: true,
            tcgPlayerId: true,
            hasNormal: true,
            hasHolo: true,
            hasReverse: true,
            hasFirstEdition: true,
            hasWPromo: true
        }
    });
    const sets = await prisma.set.findMany({
        where: { id: { in: [keeperId, ...loserIds] } },
        select: {
            id: true,
            name: true,
            logoImageKey: true,
            symbolImageKey: true,
            logoOptimized: true,
            symbolOptimized: true
        }
    });
    const rowById = new Map(rows.map((r) => [r.id, r]));
    const setById = new Map(sets.map((s) => [s.id, s]));
    const keeperSet = setById.get(keeperId);
    if (!keeperSet) {
        console.warn(`   ⏭️  SKIP ${keeperId} — keeper set row missing; re-run pnpm db:audit-set-merges`);
        return false;
    }
    const mini = (r: { id: string; name: string; number: string; setId: string }): MiniCard => ({
        id: r.id,
        name: r.name,
        number: r.number,
        setId: r.setId
    });

    const pairPlans: PairPlan[] = [];
    const setPlans: SetPlan[] = [];

    for (const loserId of loserIds) {
        const loserSet = setById.get(loserId);
        if (!loserSet) {
            console.warn(`   ⏭️  SKIP loser ${loserId} — set row missing; re-run pnpm db:audit-set-merges`);
            continue;
        }
        const keeperRows = rows.filter((r) => r.setId === keeperId);
        const loserRows = rows.filter((r) => r.setId === loserId);
        const { pairs, unmatchedBs } = matchByNameBijection(keeperRows.map(mini), loserRows.map(mini));
        if (unmatchedBs.length > 0) {
            console.warn(
                `   ⏭️  SKIP ${keeperId} <= ${loserId} — ${unmatchedBs.length} loser card(s) no longer name-pair (e.g. ${unmatchedBs[0].name}); re-run pnpm db:audit-set-merges`
            );
            totals.cardsSkipped += loserRows.length;
            return false;
        }

        for (const [winnerMini, loserMini] of pairs) {
            const winner = rowById.get(winnerMini.id)!;
            const loser = rowById.get(loserMini.id)!;
            pairPlans.push({
                winnerId: winner.id,
                loserId: loser.id,
                collections: await prisma.collectionEntry.count({ where: { cardId: loser.id } }),
                market: await prisma.marketStats.count({ where: { cardId: loser.id } }),
                marketInWinner: await prisma.marketStats.count({ where: { cardId: winner.id } }),
                history: await prisma.priceHistory.count({ where: { cardId: loser.id } }),
                historyInWinner: await prisma.priceHistory.count({ where: { cardId: winner.id } }),
                copyImage: Boolean(loser.imageKey) && !winner.imageKey,
                dropImage: Boolean(loser.imageKey) && Boolean(winner.imageKey),
                tcgPlayer: Boolean(loser.tcgPlayerId) && !winner.tcgPlayerId,
                hasFlags: FLAGS.filter((f) => loser[f] && !winner[f])
            });
        }
        setPlans.push({
            loserId,
            borrowLogo: keeperSet.logoImageKey ? null : loserSet.logoImageKey,
            borrowSymbol: keeperSet.symbolImageKey ? null : loserSet.symbolImageKey,
            borrowLogoOptimized: loserSet.logoOptimized,
            borrowSymbolOptimized: loserSet.symbolOptimized
        });
    }

    const borrowed = setPlans.flatMap((s) => [s.borrowLogo && 'logo', s.borrowSymbol && 'symbol']).filter(Boolean);
    console.log(
        `\n${apply ? '🔧' : '🧪'} [${group.reason}] ${keeperId} <= ${loserIds.join(', ')} — ${pairPlans.length} card pair(s)` +
            (borrowed.length ? `, borrow ${borrowed.join('+')}` : '')
    );
    for (const plan of pairPlans) {
        const notes: string[] = [];
        if (plan.copyImage) notes.push('copy imageKey/imagesOptimized');
        if (plan.dropImage) notes.push('drop image — winner already has one');
        if (plan.collections) notes.push('repoint collections');
        if (plan.tcgPlayer) notes.push('fill tcgPlayerId');
        if (plan.hasFlags.length) notes.push(`OR ${plan.hasFlags.join(', ')}`);
        if (plan.market) notes.push(plan.marketInWinner ? 'market dropped' : 'repoint market');
        if (plan.history) notes.push(plan.historyInWinner ? 'history dropped' : 'repoint history');
        console.log(`   ${apply ? '✅ merged' : 'would merge'} ${plan.loserId} -> ${plan.winnerId} (${notes.join('; ')})`);
    }
    for (const plan of setPlans) {
        const keys = [plan.borrowLogo && 'logo', plan.borrowSymbol && 'symbol'].filter(Boolean).join('+');
        if (keys) {
            console.log(
                `   ${apply ? '✅ borrowed' : 'would borrow'} ${plan.loserId} set images -> ${keeperId} (${keys} keys)`
            );
        }
        redirectPairs.push({ source: `/sets/${plan.loserId}`, destination: `/sets/${keeperId}` });
    }
    for (const plan of pairPlans) {
        redirectPairs.push({ source: `/cards/${plan.loserId}`, destination: `/cards/${plan.winnerId}` });
    }

    totals.groupsMerged++;

    if (!apply) return true;

    await prisma.$transaction(
        async (tx) => {
            for (const plan of pairPlans) {
                const winner = rowById.get(plan.winnerId)!;
                const loser = rowById.get(plan.loserId)!;
                if (plan.copyImage) {
                    await tx.card.update({
                        where: { id: winner.id },
                        data: { imageKey: loser.imageKey, imagesOptimized: loser.imagesOptimized }
                    });
                    totals.imagesCopied++;
                }
                await tx.collectionEntry.updateMany({ where: { cardId: loser.id }, data: { cardId: winner.id } });
                totals.collectionsRepointed += plan.collections;
                if (plan.market > 0 && !plan.marketInWinner) {
                    await tx.marketStats.updateMany({ where: { cardId: loser.id }, data: { cardId: winner.id } });
                    totals.marketRepointed += plan.market;
                } else if (plan.market > 0) {
                    await tx.marketStats.deleteMany({ where: { cardId: loser.id } });
                }
                if (plan.history > 0) {
                    if (plan.historyInWinner === 0) {
                        await tx.priceHistory.updateMany({ where: { cardId: loser.id }, data: { cardId: winner.id } });
                        totals.historyRepointed += plan.history;
                    } else {
                        await tx.priceHistory.deleteMany({ where: { cardId: loser.id } });
                        totals.historyDropped += plan.history;
                    }
                }
                await tx.card.update({
                    where: { id: winner.id },
                    data: {
                        ...(plan.tcgPlayer ? { tcgPlayerId: loser.tcgPlayerId } : {}),
                        ...(plan.hasFlags.includes('hasNormal') ? { hasNormal: true } : {}),
                        ...(plan.hasFlags.includes('hasHolo') ? { hasHolo: true } : {}),
                        ...(plan.hasFlags.includes('hasReverse') ? { hasReverse: true } : {}),
                        ...(plan.hasFlags.includes('hasFirstEdition') ? { hasFirstEdition: true } : {}),
                        ...(plan.hasFlags.includes('hasWPromo') ? { hasWPromo: true } : {})
                    }
                });
                // explicit child cleanup (mirrors scripts/applyMerges.ts)
                await tx.attackCost.deleteMany({ where: { attack: { cardId: loser.id } } });
                await tx.attack.deleteMany({ where: { cardId: loser.id } });
                await tx.ability.deleteMany({ where: { cardId: loser.id } });
                await tx.subtypesOnCards.deleteMany({ where: { cardId: loser.id } });
                await tx.typesOnCards.deleteMany({ where: { cardId: loser.id } });
                await tx.card.delete({ where: { id: loser.id } });
                totals.cardsMerged++;
            }
            for (const plan of setPlans) {
                // Borrow = repoint key strings; the R2 objects keep serving the
                // same URLs (2011bw -> sets/mcd11-logo.png).
                if (plan.borrowLogo || plan.borrowSymbol) {
                    await tx.set.update({
                        where: { id: keeperId },
                        data: {
                            ...(plan.borrowLogo
                                ? { logoImageKey: plan.borrowLogo, logoOptimized: plan.borrowLogoOptimized }
                                : {}),
                            ...(plan.borrowSymbol
                                ? { symbolImageKey: plan.borrowSymbol, symbolOptimized: plan.borrowSymbolOptimized }
                                : {})
                        }
                    });
                    totals.imageBorrows++;
                }
                // Loser is empty (pairs covered every card) — cards went first
                // because Card.set is onDelete: Restrict.
                await tx.set.delete({ where: { id: plan.loserId } });
                totals.setsDeleted++;
            }
            await tx.set.update({ where: { id: keeperId }, data: { updatedAt: new Date() } });
        },
        { timeout: 60_000 }
    );
    return true;
}