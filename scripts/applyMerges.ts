/**
 * DEDUPE PIPELINE — STEP 2: execute the merges proposed by the read-only
 * audit (scripts/dedupe-report.json). DRY RUN by default; pass --apply.
 *
 * Keeps the TCGdex row in each group (the API keeps updating it) and:
 *   1. copies imageKey/imagesOptimized from a loser holding one onto a
 *      keeper lacking one (sanctioned API divergence — the API is not the
 *      source of truth for which R2 object serves a card's art);
 *   2. repoints CollectionEntry rows loser -> keeper (ALWAYS — the FK's
 *      onDelete: Cascade would otherwise destroy users' collections);
 *   3. repoints MarketStats/PriceHistory only when the keeper has none
 *      (same physical card — never keep double series), the loser's rows
 *      are dropped otherwise;
 *   4. ORs variant flags and fills tcgPlayerId when the keeper lacks one;
 *   5. deletes the loser after explicit child cleanup (mirrors
 *      scripts/fix-zero-duplicates.ts) and bumps set.updatedAt on every
 *      touched set for a real sitemap lastmod.
 *
 * Prints ready-to-paste redirect pairs for src/lib/cardRedirects.ts.
 *
 * Usage: pnpm db:apply-merges [--apply] [--only=<substring>]
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface ReportGroup {
    reason: string;
    proposedAction: 'merge' | 'none';
    name: string;
    number: string;
    proposedKeeperId: string;
    members: { id: string; name: string; number: string; setId: string }[];
}

interface MergeReport {
    generatedAt: string;
    class1a: ReportGroup[];
    class1b: ReportGroup[];
}

const FLAGS = ['hasNormal', 'hasHolo', 'hasReverse', 'hasFirstEdition', 'hasWPromo'] as const;
type Flag = (typeof FLAGS)[number];

async function main() {
    const args = process.argv.slice(2);
    const apply = args.includes('--apply');
    const onlyArg = args.find((a) => a.startsWith('--only='));
    const only = onlyArg?.slice('--only='.length).toLowerCase() ?? null;

    const report = JSON.parse(readFileSync('scripts/dedupe-report.json', 'utf8')) as MergeReport;
    const allGroups = [...report.class1a, ...report.class1b].filter((g) => g.proposedAction === 'merge');
    const groups = allGroups.filter(
        (g) =>
            !only ||
            g.name.toLowerCase().includes(only) ||
            g.proposedKeeperId.toLowerCase().includes(only) ||
            g.members.some((m) => m.id.toLowerCase().includes(only))
    );
    console.log(
        `${apply ? '🔧 APPLYING' : '🧪 DRY RUN'} ${groups.length}/${allGroups.length} merge groups (report ${report.generatedAt})...`
    );

    const allIds = [...new Set(groups.flatMap((g) => g.members.map((m) => m.id)))];
    const rows = await prisma.card.findMany({
        where: { id: { in: allIds } },
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
    const rowById = new Map(rows.map((r) => [r.id, r]));

    const redirectPairs: { source: string; destination: string }[] = [];
    const totals = {
        merged: 0,
        skipped: 0,
        imagesCopied: 0,
        collectionsRepointed: 0,
        marketRepointed: 0,
        historyRepointed: 0,
        historyDropped: 0
    };

    for (const group of groups) {
        const keeperId = group.proposedKeeperId;
        const keeperRow = rowById.get(keeperId);
        const loserRows = group.members.filter((m) => m.id !== keeperId).map((m) => rowById.get(m.id));
        const validLosers = loserRows.filter((r): r is NonNullable<typeof r> => !!r);
        const missing = group.members.filter((m) => !rowById.has(m.id)).map((m) => m.id);
        if (!keeperRow || missing.length > 0) {
            console.warn(
                `\n⚠️  SKIP "${group.name}" #${group.number}: stale report (missing: ${missing.join(', ') || keeperId}) — re-run pnpm db:audit-duplicates.`
            );
            totals.skipped++;
            continue;
        }

        // ---- plan (printed in dry runs too) ----
        const imageDonor = !keeperRow.imageKey ? validLosers.find((l) => l.imageKey) : undefined;
        const flagPatch = Object.fromEntries(
            FLAGS.filter((f) => !keeperRow[f] && validLosers.some((l) => l[f])).map((f) => [f, true])
        ) as Partial<Record<Flag, boolean>>;
        const tcgPlayerDonor =
            keeperRow.tcgPlayerId == null ? validLosers.find((l) => l.tcgPlayerId != null) : undefined;

        const loserPlans: {
            loser: (typeof validLosers)[number];
            collections: number;
            market: number;
            history: number;
        }[] = [];
        for (const loser of validLosers) {
            loserPlans.push({
                loser,
                collections: await prisma.collectionEntry.count({ where: { cardId: loser.id } }),
                market: await prisma.marketStats.count({ where: { cardId: loser.id } }),
                history: await prisma.priceHistory.count({ where: { cardId: loser.id } })
            });
        }
        const keeperMarket = await prisma.marketStats.count({ where: { cardId: keeperId } });
        const keeperHistory = await prisma.priceHistory.count({ where: { cardId: keeperId } });

        console.log(`\n${group.reason}  "${group.name}" #${group.number}  (keeper: ${keeperId})`);
        if (imageDonor) {
            console.log(`🖼  copy image ${imageDonor.imageKey}  ${imageDonor.id} -> ${keeperId}`);
            totals.imagesCopied++;
        }
        const fills = [
            ...Object.keys(flagPatch),
            tcgPlayerDonor ? `tcgPlayerId=${tcgPlayerDonor.tcgPlayerId}` : null
        ].filter(Boolean);
        if (fills.length > 0) console.log(`🏷  fill: ${fills.join(', ')}`);

        let hasMarket = keeperMarket > 0;
        let hist = keeperHistory;
        for (const plan of loserPlans) {
            const marketNote =
                plan.market === 0 ? 'market: none' : hasMarket ? 'market: dropped (keeper has one)' : 'market: repointed';
            const historyNote =
                plan.history === 0 ? 'history: none' : hist === 0 ? `history: repoint ${plan.history}` : `history: dropped ${plan.history}`;
            if (plan.market > 0 && !hasMarket) {
                totals.marketRepointed += plan.market;
                hasMarket = true;
            }
            if (plan.history > 0) {
                if (hist === 0) {
                    totals.historyRepointed += plan.history;
                    hist = plan.history;
                } else {
                    totals.historyDropped += plan.history;
                }
            }
            totals.collectionsRepointed += plan.collections;
            console.log(
                `  ⤳ drop ${plan.loser.id}: collections ${plan.collections} repointed; ${marketNote}; ${historyNote}`
            );
            redirectPairs.push({ source: `/cards/${plan.loser.id}`, destination: `/cards/${keeperId}` });
        }
        totals.merged++;
        if (!apply) continue;

        await prisma.$transaction(
            async (tx) => {
                if (imageDonor) {
                    await tx.card.update({
                        where: { id: keeperId },
                        data: { imageKey: imageDonor.imageKey, imagesOptimized: imageDonor.imagesOptimized }
                    });
                }
                const data = {
                    ...flagPatch,
                    ...(tcgPlayerDonor ? { tcgPlayerId: tcgPlayerDonor.tcgPlayerId } : {})
                };
                if (Object.keys(data).length > 0) await tx.card.update({ where: { id: keeperId }, data });

                let marketInKeeper = keeperMarket > 0;
                let histInKeeper = keeperHistory;
                const touchSetIds = new Set<string>([keeperRow.setId]);
                for (const plan of loserPlans) {
                    touchSetIds.add(plan.loser.setId);
                    await tx.collectionEntry.updateMany({
                        where: { cardId: plan.loser.id },
                        data: { cardId: keeperId }
                    });
                    if (plan.market > 0 && !marketInKeeper) {
                        await tx.marketStats.updateMany({
                            where: { cardId: plan.loser.id },
                            data: { cardId: keeperId }
                        });
                        marketInKeeper = true;
                    }
                    if (plan.history > 0) {
                        if (histInKeeper === 0) {
                            await tx.priceHistory.updateMany({
                                where: { cardId: plan.loser.id },
                                data: { cardId: keeperId }
                            });
                            histInKeeper = plan.history;
                        } else {
                            await tx.priceHistory.deleteMany({ where: { cardId: plan.loser.id } });
                        }
                    }
                    // explicit child cleanup (mirrors scripts/fix-zero-duplicates.ts)
                    await tx.attackCost.deleteMany({ where: { attack: { cardId: plan.loser.id } } });
                    await tx.attack.deleteMany({ where: { cardId: plan.loser.id } });
                    await tx.ability.deleteMany({ where: { cardId: plan.loser.id } });
                    await tx.subtypesOnCards.deleteMany({ where: { cardId: plan.loser.id } });
                    await tx.typesOnCards.deleteMany({ where: { cardId: plan.loser.id } });
                    await tx.card.delete({ where: { id: plan.loser.id } });
                }
                for (const setId of touchSetIds) {
                    await tx.set.update({ where: { id: setId }, data: { updatedAt: new Date() } });
                }
            },
            { timeout: 60_000 }
        );
    }

    console.log(
        `\n${apply ? '✅ Merged' : '🧪 Dry run complete — no changes made.'} groups: ${totals.merged} ${apply ? 'executed' : 'would merge'}, ${totals.skipped} skipped`
    );
    console.log(
        `   collections repointed: ${totals.collectionsRepointed}, images copied: ${totals.imagesCopied}, market repointed: ${totals.marketRepointed}, history repointed: ${totals.historyRepointed}, history dropped: ${totals.historyDropped}`
    );
    console.log(`\n📋 Redirect pairs for src/lib/cardRedirects.ts (${redirectPairs.length}):`);
    for (const r of redirectPairs) console.log(`    { source: '${r.source}', destination: '${r.destination}' },`);
    if (apply) {
        console.log('\n➡️  Post-merge runbook:');
        console.log('   1. Replace the cardRedirects list in src/lib/cardRedirects.ts with the pairs above.');
        console.log('   2. pnpm typecheck && pnpm build.');
        console.log('   3. pnpm index:cards — regenerate card-index artifacts (merged ids leave the index).');
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
