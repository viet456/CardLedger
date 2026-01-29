import { PrismaClient, Card } from '@prisma/client';
import axios from 'axios';
import { ApiCard } from '../src/shared-types/price-api';

const POKEPRICETRACKER_KEY = process.env.POKEPRICETRACKER_KEY;
const prisma = new PrismaClient({
    log: ['error']
});
const API_BASE_URL = 'https://www.pokemonpricetracker.com/api/v2/cards/';

// Track active DB operations to prevent memory overflow
const MAX_PENDING_DB_BATCHES = 3;
const pendingBatches: Promise<any>[] = [];

function normalizePokemonName(name: string): string {
    return name
        .toLowerCase()
        .replace(/lv\.x/g, 'levelx') // Handle Lv.X variations
        .replace(/ ★/g, 'star') // Handle Star symbol
        .replace(/ δ/g, 'deltaspecies') // Handle Delta Species symbol
        .normalize('NFD') // Remove accents
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]|_/g, '') // Remove punctuation and spaces
        .replace(/\s+/g, '') // Collapse multiple spaces
        .trim();
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
            { timeout: 10000 }
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

async function getCardPage(setId: string, limit: number, offset: number) {
    try {
        const response = await axios.get(`${API_BASE_URL}`, {
            headers: {
                Authorization: `Bearer ${POKEPRICETRACKER_KEY}`
            },
            params: {
                setId: `${setId}`,
                limit: limit,
                offset: offset
            },
            timeout: 60000
        });
        return response.data;
    } catch (error) {
        const msg = axios.isAxiosError(error) ? error.message : String(error);
        console.error(` ❌ FAILED to fetch data for ${setId} at offset ${offset}:`, msg);
        throw error;
    }
}

async function upsertCardMarketStats(myCardId: string, apiCard: ApiCard) {
    const prices = apiCard.prices;

    // DEBUG
    if (!prices) {
        console.log(`❌ No prices object for ${myCardId}`);
        console.log('Full apiCard:', JSON.stringify(apiCard, null, 2));
        return;
    }
    const primaryPrinting = prices.primaryPrinting || Object.keys(prices.variants || {})[0];
    const primaryVariant = prices.variants?.[primaryPrinting];
    if (!primaryVariant) {
        console.log(`⚠️ No variant data for ${myCardId}, skipping`);
        return;
    }

    let latestNearMintPrice: number | undefined;
    let latestLightlyPlayedPrice: number | undefined;
    let latestModeratelyPlayedPrice: number | undefined;
    let latestHeavilyPlayedPrice: number | undefined;
    let latestDamagedPrice: number | undefined;

    for (const [conditionKey, conditionData] of Object.entries(primaryVariant)) {
        const price = (conditionData as any).price;

        if (conditionKey.includes('Near Mint')) {
            latestNearMintPrice = price;
        } else if (conditionKey.includes('Lightly Played')) {
            latestLightlyPlayedPrice = price;
        } else if (conditionKey.includes('Moderately Played')) {
            latestModeratelyPlayedPrice = price;
        } else if (conditionKey.includes('Heavily Played')) {
            latestHeavilyPlayedPrice = price;
        } else if (conditionKey.includes('Damaged')) {
            latestDamagedPrice = price;
        }
    }

    const tcgLastUpdatedAt = apiCard.prices?.lastUpdated;
    const validTcgUpdatedAt = tcgLastUpdatedAt ? new Date(tcgLastUpdatedAt) : undefined;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upsertMarketStats = prisma.marketStats.upsert({
        where: { cardId: myCardId },
        update: {
            tcgNearMintLatest: latestNearMintPrice ?? null,
            tcgLightlyPlayedLatest: latestLightlyPlayedPrice ?? null,
            tcgModeratelyPlayedLatest: latestModeratelyPlayedPrice ?? null,
            tcgHeavilyPlayedLatest: latestHeavilyPlayedPrice ?? null,
            tcgDamagedLatest: latestDamagedPrice ?? null,
            tcgPlayerUpdatedAt: validTcgUpdatedAt
        },
        create: {
            cardId: myCardId,
            tcgNearMintLatest: latestNearMintPrice,
            tcgLightlyPlayedLatest: latestLightlyPlayedPrice,
            tcgModeratelyPlayedLatest: latestModeratelyPlayedPrice,
            tcgHeavilyPlayedLatest: latestHeavilyPlayedPrice,
            tcgDamagedLatest: latestDamagedPrice,
            tcgPlayerUpdatedAt: validTcgUpdatedAt ?? new Date()
        }
    });

    const upsertPriceHistory = prisma.priceHistory.upsert({
        where: {
            cardId_timestamp: {
                cardId: myCardId,
                timestamp: today
            }
        },
        update: {
            tcgNearMint: latestNearMintPrice ?? null,
            tcgLightlyPlayed: latestLightlyPlayedPrice ?? null,
            tcgModeratelyPlayed: latestModeratelyPlayedPrice ?? null,
            tcgHeavilyPlayed: latestHeavilyPlayedPrice ?? null,
            tcgDamaged: latestDamagedPrice ?? null
        },
        create: {
            cardId: myCardId,
            timestamp: today,
            tcgNearMint: latestNearMintPrice ?? null,
            tcgLightlyPlayed: latestLightlyPlayedPrice ?? null,
            tcgModeratelyPlayed: latestModeratelyPlayedPrice ?? null,
            tcgHeavilyPlayed: latestHeavilyPlayedPrice ?? null,
            tcgDamaged: latestDamagedPrice
        }
    });

    const [marketStatsResult, priceHistoryResult] = await Promise.allSettled([
        upsertMarketStats,
        upsertPriceHistory
    ]);

    if (marketStatsResult.status === 'rejected') {
        console.error(
            ` ❌ FAILED to upsert MarketStats for ${myCardId}:`,
            marketStatsResult.reason
        );
    }
    if (priceHistoryResult.status === 'rejected') {
        console.error(` ❌ FAILED to write history for ${myCardId}:`, priceHistoryResult.reason);
    }
}

async function processBatch(apiCards: ApiCard[], dbCards: Pick<Card, 'id' | 'number' | 'name'>[]) {
    const upsertPromises: Promise<void>[] = [];

    // Create a generic number map
    const dbCardMap = new Map<string, (typeof dbCards)[0]>();
    const processedCardIds = new Set<string>();

    for (const card of dbCards) {
        const normalizedDbNumber = card.number.split('/')[0].replace(/^0+/, '').trim();
        dbCardMap.set(normalizedDbNumber, card);
    }

    for (const apiCard of apiCards) {
        const apiCardNumberRaw = String(apiCard.cardNumber);
        const normalizedApiNumberString = apiCardNumberRaw.split('/')[0].replace(/^0+/, '').trim();
        const apiCardName = apiCard.name;

        // Find by number first
        const myCard = dbCardMap.get(normalizedApiNumberString);

        if (!myCard) {
            // console.log(` - ℹ️  No match found for API card number: '${apiCardNumberRaw}' (${apiCardName})`);
            continue;
        }

        // --- ROBUST NAME MATCHING ---
        // Strip suffixes like "(Alternate Art Secret)" or "(Promo)"
        const apiNameClean = apiCardName.replace(/\s*\([^)]*\)\s*/g, '').trim();
        const dbNameClean = myCard.name.replace(/\s*\([^)]*\)\s*/g, '').trim();

        const normalizedApiCardName = normalizePokemonName(apiNameClean);
        const normalizedDbCardName = normalizePokemonName(dbNameClean);

        let cardMatchIsValid = false;

        // Perform loose validation
        if (
            normalizedDbCardName.includes(normalizedApiCardName) ||
            normalizedApiCardName.includes(normalizedDbCardName)
        ) {
            cardMatchIsValid = true;
        } else {
            // Only log significant name mismatches
            console.log(
                `  - ⚠️  Number match (${myCard.number}), but names differ greatly: DB='${normalizedDbCardName}' vs API='${normalizedApiCardName}'`
            );
        }

        if (cardMatchIsValid) {
            if (processedCardIds.has(myCard.id)) {
                // console.log(`Skipping duplicate update for ${myCard.id} in same batch`);
                continue;
            }
            processedCardIds.add(myCard.id);

            upsertPromises.push(
                upsertCardMarketStats(myCard.id, apiCard).catch((error) => {
                    console.error(
                        `❌ Error processing card ${apiCard.cardNumber} (${apiCardName}):`,
                        error
                    );
                })
            );
        }
    }

    await Promise.all(upsertPromises);
}

async function main() {
    const START_TIME = Date.now();
    const MAX_RUNTIME_MS = 90 * 60 * 1000; // 90 mins

    const dbSets = await prisma.set.findMany({
        select: {
            id: true,
            tcgPlayerNumericId: true,
            name: true
        },
        orderBy: {
            releaseDate: 'desc'
        }
    });

    // Latest sets to always be updated
    const highPrioritySets = dbSets.slice(0, 12);

    // Starts day count from Jan 1 1970, Unix Epoch
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysSinceEpoch = Math.floor(Date.now() / msPerDay);
    const isEvenDay = daysSinceEpoch % 2 === 0;

    const alternatingSets = dbSets.filter((_, index) => {
        return (index % 2 === 0) === isEvenDay;
    });
    const setsToProcessMap = new Map(alternatingSets.map((set) => [set.id, set]));

    for (const set of highPrioritySets) {
        setsToProcessMap.set(set.id, set);
    }
    const setsToProcess = Array.from(setsToProcessMap.values());

    console.log(`Starting daily MarketStats update for ${setsToProcess.length} sets...`);

    for (const set of setsToProcess) {
        if (Date.now() - START_TIME > MAX_RUNTIME_MS) {
            console.warn('⚠️ Max runtime reached. Stopping set processing early.');
            break;
        }
        if (!set.tcgPlayerNumericId) {
            console.log(`Skipping set ${set.name} (missing numeric tcgPlayerId)`);
            continue;
        }
        console.log(`Processing set: ${set.name} (${set.id})`);

        const dbCards = await prisma.card.findMany({
            where: {
                setId: set.id
            },
            select: {
                id: true,
                number: true,
                name: true
            }
        });

        const PAGE_SIZE = 50;
        let currentOffset = 0;
        let keepFetching = true;

        while (keepFetching) {
            let pageData;

            try {
                pageData = await getCardPage(
                    String(set.tcgPlayerNumericId),
                    PAGE_SIZE,
                    currentOffset
                );
            } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 429) {
                    console.log(`- ⚠️ Got 429. Waiting 60 seconds to retry...`);
                    await new Promise((resolve) => setTimeout(resolve, 60000));
                    continue;
                } else {
                    console.log(` -> Fetch failed, skipping rest of set ${set.name}.`);
                    break;
                }
            }

            if (!pageData || !pageData.data || pageData.data.length === 0) {
                keepFetching = false;
                break;
            }

            const apiCards: ApiCard[] = pageData.data;

            const waitTimeInSeconds = Math.ceil(PAGE_SIZE / 10) + 4;
            const timerPromise = new Promise((resolve) =>
                setTimeout(resolve, waitTimeInSeconds * 1000)
            );

            const batchPromise = processBatch(apiCards, dbCards).catch((error) =>
                console.error('Batch failed', error)
            );
            pendingBatches.push(batchPromise);

            if (pendingBatches.length > MAX_PENDING_DB_BATCHES) {
                const oldestBatch = pendingBatches.shift();
                await oldestBatch;
            }

            await timerPromise;

            console.log(
                ` -> Fetched ${apiCards.length} cards. (Queue: ${pendingBatches.length} active batches)`
            );

            currentOffset += PAGE_SIZE;
            if (apiCards.length < PAGE_SIZE) {
                keepFetching = false;
            }
        }
        console.log(` -> Finished processing set: ${set.name}.`);
    }

    console.log('Waiting for final DB writes...');
    await Promise.all(pendingBatches);

    console.log('✅ Daily MarketStats update complete.');
    await revalidateNextCache();
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
