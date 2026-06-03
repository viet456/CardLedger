import { PrismaClient } from '@prisma/client';
import TCGdex from '@tcgdex/sdk';
import axios from 'axios';

const prisma = new PrismaClient({
    log: ['error']
});
const tcgdex = new TCGdex('en');

// Global exchange rate for converting Cardmarket (EUR) to USD. Default fallback is 1.08.
let eurToUsdExchangeRate = 1.08;

// Parallel processing config
const CARD_BATCH_SIZE = 5; // Paced to process ~21,000 cards over 40-50 minutes to avoid hitting rate limits
const SET_BATCH_SIZE = 1; // Process one set at a time to be very safe during migration

async function fetchExchangeRate(): Promise<number> {
    const DEFAULT_RATE = 1.08;
    try {
        console.log('Fetching current EUR to USD exchange rate...');
        const response = await axios.get('https://open.er-api.com/v6/latest/EUR', { timeout: 5000 });
        const rate = response.data?.rates?.USD;
        if (typeof rate === 'number') {
            console.log(`✅ Fetched active EUR to USD exchange rate: ${rate}`);
            return rate;
        }
        console.warn(`⚠️ Unexpected exchange rate response format. Using fallback: ${DEFAULT_RATE}`);
        return DEFAULT_RATE;
    } catch (error) {
        console.warn(
            `⚠️ Failed to fetch exchange rate (${error instanceof Error ? error.message : error}). Using fallback: ${DEFAULT_RATE}`
        );
        return DEFAULT_RATE;
    }
}

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

async function upsertCardMarketStats(cardId: string, fullCard: any) {
    const pricingFull = fullCard?.pricing || { tcgplayer: fullCard?.tcgplayer, cardmarket: fullCard?.cardmarket };
    if (!pricingFull) return;

    // Prefer TCGPlayer, fallback to Cardmarket
    const tcg = pricingFull.tcgplayer;
    const cm = pricingFull.cardmarket;

    if (!tcg && !cm) return; // No pricing data at all

    // Extract TCGPlayer prices
    const tcgNormal = tcg?.normal?.market ?? tcg?.normal?.marketPrice ?? tcg?.unlimited?.marketPrice ?? null;
    const tcgHolo = tcg?.holo?.market ?? tcg?.holo?.marketPrice ?? tcg?.holofoil?.marketPrice ?? tcg?.['unlimited-holofoil']?.marketPrice ?? null;
    const tcgReverse = tcg?.reverse?.market ?? tcg?.reverse?.marketPrice ?? tcg?.['reverse-holofoil']?.marketPrice ?? tcg?.reverseHolofoil?.marketPrice ?? null;
    const tcg1stEd = tcg?.firstEdition?.market ?? tcg?.firstEdition?.marketPrice ?? tcg?.['1st Edition']?.marketPrice ?? tcg?.['1stEditionHolofoil']?.marketPrice ?? tcg?.['1st-edition-holofoil']?.marketPrice ?? tcg?.['1st-edition']?.marketPrice ?? null;

    // Cardmarket fallback sequence keys
    const cmFallback = (base: string) => {
        const prefix = base ? `-${base}` : '';
        return cm?.[`avg${prefix}`] ?? 
               cm?.[`trend${prefix}`] ?? 
               cm?.[`avg1${prefix}`] ?? 
               cm?.[`avg7${prefix}`] ?? 
               cm?.[`avg30${prefix}`] ?? 
               cm?.[`low${prefix}`] ?? null;
    };

    // Extract Cardmarket prices with robust fallback
    let cmNormal = cmFallback('');
    let cmHolo = cmFallback('holo');
    let cmReverse = cmFallback('reverse');
    let cm1stEd = cmFallback('1st');

    // Determine exactly which variants truly exist.
    // TCGPlayer is our trusted source of truth because API top-level boolean variants are unreliable.
    // If TCGPlayer has no data, we fall back to trusting the API booleans.
    const isValidNormal = tcg ? tcgNormal !== null : !!fullCard?.variants?.normal;
    const isValidHolo = tcg ? tcgHolo !== null : !!fullCard?.variants?.holo;
    const isValidReverse = tcg ? tcgReverse !== null : !!fullCard?.variants?.reverse;
    const isValid1stEd = tcg ? tcg1stEd !== null : !!fullCard?.variants?.firstEdition;

    // Smart mapping: Cardmarket variants can be unreliable and often lump default variants into the generic "avg" (cmNormal) keys.
    // For example, their "holo" property might be present as a ghost variant, or their generic price represents the only valid variant.
    // So we look back to the confirmed valid variants (prioritizing TCGPlayer or the API) to check which variant Cardmarket truly represents.
    // If the card is known to NOT have a normal variant, we map cmNormal to the primary valid variant.
    if (!isValidNormal && cmNormal !== null) {
        if (isValidHolo && cmHolo === null) {
            cmHolo = cmNormal;
        } else if (isValidReverse && cmReverse === null) {
            cmReverse = cmNormal;
        } else if (isValid1stEd && cm1stEd === null) {
            cm1stEd = cmNormal;
        }
        cmNormal = null;
    }

    // Prevent Cardmarket from introducing "ghost" variants that TCGPlayer doesn't support.
    if (!isValidNormal) cmNormal = null;
    if (!isValidHolo) cmHolo = null;
    if (!isValidReverse) cmReverse = null;
    if (!isValid1stEd) cm1stEd = null;

    // Cardmarket often lumps reverse into normal if both exist and reverse is unspecified
    if (isValidReverse && cmReverse === null && cmNormal !== null) {
        cmReverse = cmNormal;
    }

    // Convert EUR Cardmarket prices to USD if needed (we're storing all in USD)
    const isEur = cm?.unit === 'EUR';
    if (isEur) {
        if (cmNormal !== null) cmNormal = Math.round(cmNormal * eurToUsdExchangeRate * 100) / 100;
        if (cmHolo !== null) cmHolo = Math.round(cmHolo * eurToUsdExchangeRate * 100) / 100;
        if (cmReverse !== null) cmReverse = Math.round(cmReverse * eurToUsdExchangeRate * 100) / 100;
        if (cm1stEd !== null) cm1stEd = Math.round(cm1stEd * eurToUsdExchangeRate * 100) / 100;
    }

    // Blend: Use TCGPlayer if available, else Cardmarket
    const pNormal = tcgNormal ?? cmNormal;
    const pHolo = tcgHolo ?? cmHolo;
    const pReverse = tcgReverse ?? cmReverse;
    const p1stEd = tcg1stEd ?? cm1stEd;

    const basePrice = pNormal ?? pHolo ?? pReverse ?? p1stEd;
    if (basePrice === null) return; 

    // Determine the updated timestamp (prefer TCGPlayer's date if we used TCGPlayer data)
    const activeProvider = tcgNormal ?? tcgHolo ?? tcgReverse ?? tcg1stEd ? tcg : cm;
    const lastUpdatedAt = activeProvider?.updated;
    
    // If the API does not provide a valid timestamp for this price, do not assume today's date.
    // We strictly rely on the API's reported update time. If missing, we abort to prevent 
    // polluting the database with unverified or duplicate historical points.
    if (!lastUpdatedAt) return;

    const validUpdatedAt = new Date(lastUpdatedAt);
    
    const historyTimestamp = new Date(lastUpdatedAt);
    historyTimestamp.setHours(0, 0, 0, 0);

    try {
        // Prepare cleanup operations for ghost variants in historical data
        const historyCleanupOps = [];
        if (!isValidNormal) historyCleanupOps.push(prisma.priceHistory.updateMany({ where: { cardId: cardId, tcgNormal: { not: null } }, data: { tcgNormal: null } }));
        if (!isValidHolo) historyCleanupOps.push(prisma.priceHistory.updateMany({ where: { cardId: cardId, tcgHolo: { not: null } }, data: { tcgHolo: null } }));
        if (!isValidReverse) historyCleanupOps.push(prisma.priceHistory.updateMany({ where: { cardId: cardId, tcgReverse: { not: null } }, data: { tcgReverse: null } }));
        if (!isValid1stEd) historyCleanupOps.push(prisma.priceHistory.updateMany({ where: { cardId: cardId, tcgFirstEdition: { not: null } }, data: { tcgFirstEdition: null } }));

        await prisma.$transaction([
            ...historyCleanupOps,
            prisma.marketStats.upsert({
                where: { cardId: cardId },
                update: {
                    tcgNearMintLatest: basePrice, 
                    tcgNormalLatest: pNormal,
                    tcgHoloLatest: pHolo,
                    tcgReverseLatest: pReverse,
                    tcgFirstEditionLatest: p1stEd,
                    tcgPlayerUpdatedAt: validUpdatedAt
                },
                create: {
                    cardId: cardId,
                    tcgNearMintLatest: basePrice,
                    tcgNormalLatest: pNormal,
                    tcgHoloLatest: pHolo,
                    tcgReverseLatest: pReverse,
                    tcgFirstEditionLatest: p1stEd,
                    tcgPlayerUpdatedAt: validUpdatedAt
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
                            const success = await upsertCardMarketStats(fullCard.id, fullCard);
                            return success ? 1 : 0;
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

    // Fetch exchange rate once on startup
    eurToUsdExchangeRate = await fetchExchangeRate();

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
