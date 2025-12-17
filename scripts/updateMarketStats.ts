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
    return (
        name
            .toLowerCase()
            .replace(/lv\.x/g, 'levelx') // Handle Lv.X variations
            .replace(/ ★/g, 'star') // Handle Star symbol
            .replace(/ δ/g, 'deltaspecies') // Handle Delta Species symbol
            // Remove accents
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s]|_/g, '') // Remove punctuation and spaces
            .replace(/\s+/g, '') // Collapse multiple spaces
            .trim()
    );
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
    const prices = apiCard.prices?.conditions;
    const latestNearMintPrice = prices?.['Near Mint']?.price;
    const latestLightlyPlayedPrice = prices?.['Lightly Played']?.price;
    const latestModeratelyPlayedPrice = prices?.['Moderately Played']?.price;
    const latestHeavilyPlayedPrice = prices?.['Heavily Played']?.price;
    const latestDamagedPrice = prices?.['Damaged']?.price;

    const tcgLastUpdatedAt = apiCard.prices?.lastUpdated;
    const validTcgUpdatedAt = tcgLastUpdatedAt ? new Date(tcgLastUpdatedAt) : undefined;
    const priceDate = tcgLastUpdatedAt ? new Date(tcgLastUpdatedAt) : new Date();
    priceDate.setHours(0, 0, 0, 0);

    const upsertMarketStats = prisma.marketStats.upsert({
        where: { cardId: myCardId },
        update: {
            tcgNearMintLatest: latestNearMintPrice,
            tcgLightlyPlayedLatest: latestLightlyPlayedPrice,
            tcgModeratelyPlayedLatest: latestModeratelyPlayedPrice,
            tcgHeavilyPlayedLatest: latestHeavilyPlayedPrice,
            tcgDamagedLatest: latestDamagedPrice,
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
                timestamp: priceDate
            }
        },
        update: {
            tcgNearMint: latestNearMintPrice,
            tcgLightlyPlayed: latestLightlyPlayedPrice,
            tcgModeratelyPlayed: latestModeratelyPlayedPrice,
            tcgHeavilyPlayed: latestHeavilyPlayedPrice,
            tcgDamaged: latestDamagedPrice
        },
        create: {
            cardId: myCardId,
            timestamp: priceDate,
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

    for (const apiCard of apiCards) {
        const apiCardNumberRaw = String(apiCard.cardNumber);
        const normalizedApiNumberString = apiCardNumberRaw.split('/')[0].replace(/^0+/, '');
        const apiCardName = apiCard.name;

        // Find by number first
        const myCard = dbCards.find((c) => c.number === normalizedApiNumberString);

        if (!myCard) {
            console.log(
                ` - ℹ️  No match found for API card number: '${apiCardNumberRaw}' (${apiCardName})`
            );
            continue;
        }

        const normalizedApiCardName = normalizePokemonName(apiCardName);
        const normalizedDbCardName = normalizePokemonName(myCard.name);

        let cardMatchIsValid = false;

        // Perform name validation
        if (
            normalizedDbCardName.includes(normalizedApiCardName) ||
            normalizedApiCardName.includes(normalizedDbCardName)
        ) {
            cardMatchIsValid = true;
        } else {
            console.log(
                `  - ⚠️  Number match (${myCard.number}), but normalized names differ! DB_norm: '${normalizedDbCardName}', API_norm: '${normalizedApiCardName}'. Skipping.`
            );
        }

        if (cardMatchIsValid) {
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
    const dbSets = await prisma.set.findMany({
        select: {
            id: true,
            tcgPlayerSetId: true,
            name: true
        },
        orderBy: {
            releaseDate: 'desc'
        }
    });

    // Uncomment this section to revert to "Alternating Days" strategy
    /*
    const latestSet = dbSets[0];
    const dayOfMonth = new Date().getDate();
    const isEvenDay = dayOfMonth % 2 === 0;
    const alternatingSets = dbSets.filter((_, index) => {
        return (index % 2 === 0) === isEvenDay;
    });
    const setsToProcessMap = new Map(alternatingSets.map((set) => [set.id, set]));
    if (latestSet) {
        setsToProcessMap.set(latestSet.id, latestSet);
    }
    const setsToProcess = Array.from(setsToProcessMap.values());
    setsToProcess.sort((a, b) => {
        if (a.id === latestSet.id) return -1; 
        if (b.id === latestSet.id) return 1; 
        return 0; 
    });
    */

    const setsToProcess = dbSets; // Currently processing ALL sets

    console.log(`Starting daily MarketStats update for ${setsToProcess.length} sets...`);

    for (const set of setsToProcess) {
        if (!set.tcgPlayerSetId) {
            console.log(`Skipping set ${set.name} (missing tcgPlayerSetId)`);
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
                pageData = await getCardPage(set.tcgPlayerSetId, PAGE_SIZE, currentOffset);
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

            const waitTimeInSeconds = Math.ceil(PAGE_SIZE / 10) + 1;
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
