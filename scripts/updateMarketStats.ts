import { PrismaClient } from '@prisma/client';
import TCGdex from '@tcgdex/sdk';
import axios from 'axios';

const prisma = new PrismaClient({
    log: ['error']
});
const tcgdex = new TCGdex('en');

// Parallel processing config
const CARD_BATCH_SIZE = 5; // Paced to process ~21,000 cards over 40-50 minutes to avoid hitting rate limits
const SET_BATCH_SIZE = 1; // Process one set at a time to be very safe during migration

async function revalidateNextCache() {
    const token = process.env.REVALIDATION_TOKEN;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!token || !appUrl) {
        console.warn(
            '⚠️ REVALIDATION_TOKEN or NEXT_PUBLIC_APP_URL not set. Skipping cache revalidation.'
        );
        return;
    }

    try {
        console.log(`Attempting to revalidate Next.js cache...`);
        const response = await axios.post(
            `${appUrl}/api/revalidate-cards?token=${token}`,
            {},
            { 
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            }
        );
        if (response.status === 200) {
            console.log(`✅ Successfully revalidated Next.js cache.`);
        } else {
            console.error(`❌ Failed to revalidate cache. Status: ${response.status}`);
        }
    } catch (error) {
        console.error(
            '❌ Error calling revalidation API:',
            error instanceof Error ? error.message : error
        );
    }
}

async function warmSetCaches(setsToProcess: { id: string, name: string }[]) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) return;

    console.log(`-- Warming Next.js cache for ${setsToProcess.length} sets to prevent DB trickle...`);
    
    for (let i = 0; i < setsToProcess.length; i += 10) {
        const batch = setsToProcess.slice(i, i + 10);
        await Promise.all(
            batch.map(set => 
                axios.get(`${appUrl}/sets/${set.id}`).catch(() => {}) 
            )
        );
    }
    console.log('✅ Cache warming complete.');
}

async function upsertCardMarketStats(cardId: string, pricingData: any) {
    if (!pricingData) return;

    const pNormal = pricingData.normal?.market ?? pricingData.normal?.marketPrice ?? null;
    const pHolo = pricingData.holo?.market ?? pricingData.holo?.marketPrice ?? pricingData.holofoil?.marketPrice ?? null;
    const pReverse = pricingData.reverse?.market ?? pricingData.reverse?.marketPrice ?? pricingData['reverse-holofoil']?.marketPrice ?? pricingData.reverseHolofoil?.marketPrice ?? null;
    const p1stEd = pricingData.firstEdition?.market ?? pricingData.firstEdition?.marketPrice ?? pricingData['1st Edition']?.marketPrice ?? pricingData['1stEditionHolofoil']?.marketPrice ?? null;

    const basePrice = pNormal ?? pHolo ?? pReverse ?? p1stEd;
    if (basePrice === null) return; // No pricing data at all

    const tcgLastUpdatedAt = pricingData.updated;
    const historyTimestamp = tcgLastUpdatedAt ? new Date(tcgLastUpdatedAt) : new Date();
    historyTimestamp.setHours(0, 0, 0, 0);

    const validTcgUpdatedAt = tcgLastUpdatedAt ? new Date(tcgLastUpdatedAt) : undefined;

    try {
        await prisma.$transaction([
            prisma.marketStats.upsert({
                where: { cardId: cardId },
                update: {
                    tcgNearMintLatest: basePrice, 
                    tcgNormalLatest: pNormal,
                    tcgHoloLatest: pHolo,
                    tcgReverseLatest: pReverse,
                    tcgFirstEditionLatest: p1stEd,
                    tcgPlayerUpdatedAt: validTcgUpdatedAt
                },
                create: {
                    cardId: cardId,
                    tcgNearMintLatest: basePrice,
                    tcgNormalLatest: pNormal,
                    tcgHoloLatest: pHolo,
                    tcgReverseLatest: pReverse,
                    tcgFirstEditionLatest: p1stEd,
                    tcgPlayerUpdatedAt: validTcgUpdatedAt ?? new Date()
                }
            }),
            prisma.priceHistory.upsert({
                where: {
                    cardId_timestamp: {
                        cardId: cardId,
                        timestamp: historyTimestamp
                    }
                },
                update: {
                    tcgNearMint: basePrice,
                    tcgNormal: pNormal,
                    tcgHolo: pHolo,
                    tcgReverse: pReverse,
                    tcgFirstEdition: p1stEd
                },
                create: {
                    cardId: cardId,
                    timestamp: historyTimestamp,
                    tcgNearMint: basePrice,
                    tcgNormal: pNormal,
                    tcgHolo: pHolo,
                    tcgReverse: pReverse,
                    tcgFirstEdition: p1stEd
                }
            })
        ]);
        return true;
    } catch (error) {
        console.error(` ❌ FAILED to write DB for ${cardId}:`, error);
        return false;
    }
}

async function processSet(set: { id: string, tcgdexId: string | null, name: string }) {
    console.log(`Processing set: ${set.name} (${set.id})`);
    
    try {
        const setDetails = await tcgdex.fetch('sets', set.tcgdexId!);
        if (!setDetails || !setDetails.cards) return 0;

        let updatedCount = 0;
        const cards = setDetails.cards;

        // Process cards in small batches to respect rate limits and memory
        for (let i = 0; i < cards.length; i += CARD_BATCH_SIZE) {
            const batch = cards.slice(i, i + CARD_BATCH_SIZE);
            const results = await Promise.all(
                batch.map(async (cardRef) => {
                    try {
                        const fullCard = await tcgdex.fetch('cards', cardRef.id) as any;
                        if (fullCard) {
                            // TCGdex pricing data can be under 'tcgplayer' or 'pricing.tcgplayer'
                            const pricingData = fullCard.tcgplayer || fullCard.pricing?.tcgplayer;
                            if (pricingData) {
                                const success = await upsertCardMarketStats(fullCard.id, pricingData);
                                return success ? 1 : 0;
                            }
                        }
                    } catch (e) {
                        console.warn(`\n    ⚠️ Failed to fetch pricing for card ${cardRef.id}`);
                    }
                    return 0;
                })
            );
            updatedCount += (results as number[]).reduce((a, b) => a + b, 0);
            
            const processed = Math.min(i + CARD_BATCH_SIZE, cards.length);
            process.stdout.write(`\r    ⏳ Progress: ${processed} / ${cards.length} cards checked (${updatedCount} updated)`);
        }
        
        console.log(`\n -> Finished ${set.name}: Updated ${updatedCount}/${cards.length} cards.`);
        return updatedCount;
    } catch (error) {
        console.error(` -> Failed to fetch TCGdex data for set ${set.name}:`, error);
        return 0;
    }
}

async function main() {
    const START_TIME = Date.now();
    const MAX_RUNTIME_MS = 60 * 60 * 1000; // 60 mins

    const dbSets = await prisma.set.findMany({
        where: {
            tcgdexId: { not: null }
        },
        select: {
            id: true,
            tcgdexId: true,
            name: true
        },
        orderBy: {
            releaseDate: 'desc'
        }
    });

    console.log(`Starting MarketStats update via TCGdex for ${dbSets.length} sets...`);

    let totalUpdated = 0;

    // Process all sets one by one for safety
    for (let i = 0; i < dbSets.length; i += SET_BATCH_SIZE) {
        if (Date.now() - START_TIME > MAX_RUNTIME_MS) {
            console.warn('⚠️ Max runtime reached. Stopping early.');
            break;
        }

        const batch = dbSets.slice(i, i + SET_BATCH_SIZE);
        const results = await Promise.all(batch.map(set => processSet(set)));
        totalUpdated += results.reduce((a, b) => a + b, 0);
    }

    console.log(`✅ Daily MarketStats update complete. Total cards updated: ${totalUpdated}`);
    await revalidateNextCache();
    await warmSetCaches(dbSets);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
