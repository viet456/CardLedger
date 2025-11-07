import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import {
    PriceHistoryDbRow,
    ApiCard,
    conditionsMarketMap,
    conditionsVolumeMap
} from '../src/shared-types/price-api';

const POKEPRICETRACKER_KEY = process.env.POKEPRICETRACKER_KEY;
const prisma = new PrismaClient();
const API_BASE_URL = 'https://www.pokemonpricetracker.com/api/v2/cards/';
// Track completed sets
const COMPLETED_SETS_FILE = path.join(__dirname, '_completed_backfill_sets.txt');

async function getSets() {
    const dbSets = await prisma.set.findMany({
        select: {
            id: true,
            tcgPlayerSetId: true,
            name: true
        }
    });
    return dbSets;
}
async function getSetPriceHistory(set: string, setName: string) {
    try {
        const response = await axios.get(`${API_BASE_URL}`, {
            headers: {
                Authorization: `Bearer ${POKEPRICETRACKER_KEY}`
            },
            params: {
                setId: `${set}`,
                fetchAllInSet: true,
                //includeBoth: true,
                includeHistory: true,
                days: 9999 // back to 1999, year of first release
            },
            timeout: 60000
        });
        if (!response.data || !response.data.data) {
            console.warn(`⚠️ No data found in API response for set ${setName} (${set})`);
            return null;
        }
        return response.data;
    } catch (error) {
        console.error(` ❌ FAILED to fetch data for ${set}:`, error.message);
        return null;
    }
}

async function processAndWriteHistory(myCardId: string, myCardNumber: string, apiCard: ApiCard) {
    const entriesByDate = new Map<string, Partial<PriceHistoryDbRow>>();

    // tcgplayer data
    const conditions = [
        'Near Mint',
        'Lightly Played',
        'Moderately Played',
        'Heavily Played',
        'Damaged'
    ];
    for (const condition of conditions) {
        const priceHistoryArray = apiCard.priceHistory.conditions[condition]?.history;
        if (!priceHistoryArray || priceHistoryArray.length === 0) continue;
        const marketKey = conditionsMarketMap[condition];
        const volumeKey = conditionsVolumeMap[condition];
        if (!marketKey || !volumeKey) continue;

        for (const historyItem of priceHistoryArray) {
            const dateString = historyItem.date;
            if (!entriesByDate.has(dateString)) {
                entriesByDate.set(dateString, { timestamp: new Date(dateString) });
            }
            const row = entriesByDate.get(dateString)!;
            const market = parseFloat(String(historyItem.market));
            const volume =
                historyItem.volume !== null ? parseInt(String(historyItem.volume), 10) : null;
            if (!isNaN(market)) {
                row[marketKey] = market;
            }
            if (volume !== null && !isNaN(volume)) {
                row[volumeKey] = volume;
            }
        }
    }

    // Ebay PSA pricing
    // const grades = ['psa8', 'psa9', 'psa10'];
    // const ebayPriceHistory = apiCard.ebay?.priceHistory;
    // if (ebayPriceHistory) {
    //     for (const grade of grades) {
    //         const gradeHistory = ebayPriceHistory[grade];
    //         if (!gradeHistory) continue;

    //         const marketKey = psaGradeMarketMap[grade];
    //         const volumeKey = psaGradeVolumeMap[grade];

    //         for (const dateString of Object.keys(gradeHistory)) {
    //             const historyItem = gradeHistory[dateString];
    //             // merge with TCGplayer row
    //             if (!entriesByDate.has(dateString)) {
    //                 entriesByDate.set(dateString, { timestamp: new Date(dateString) });
    //             }
    //             const row = entriesByDate.get(dateString)!;
    //             const market = parseFloat(String(historyItem.average));
    //             const volume =
    //                 historyItem.count !== null
    //                     ? parseInt(String(historyItem.count), 10)
    //                     : null;
    //             if (!isNaN(market)) {
    //                 row[marketKey] = market;
    //             }
    //             if (volume !== null && !isNaN(volume)) {
    //                 row[volumeKey] = volume;
    //             }
    //         }
    //     }
    //}

    // normalize TCGplayer entries for db
    const dataForPrisma: PriceHistoryDbRow[] = Array.from(entriesByDate.values()).map((row) => ({
        cardId: myCardId,
        timestamp: row.timestamp!,
        tcgNearMint: row.tcgNearMint ?? null,
        tcgLightlyPlayed: row.tcgLightlyPlayed ?? null,
        tcgModeratelyPlayed: row.tcgModeratelyPlayed ?? null,
        tcgHeavilyPlayed: row.tcgHeavilyPlayed ?? null,
        tcgDamaged: row.tcgDamaged ?? null,
        tcgNearMintVolume: row.tcgNearMintVolume ?? null,
        tcgLightlyPlayedVolume: row.tcgLightlyPlayedVolume ?? null,
        tcgModeratelyPlayedVolume: row.tcgModeratelyPlayedVolume ?? null,
        tcgHeavilyPlayedVolume: row.tcgHeavilyPlayedVolume ?? null,
        tcgDamagedVolume: row.tcgDamagedVolume ?? null

        // psa8MedianPrice: row.psa8MedianPrice ?? null,
        // psa9MedianPrice: row.psa9MedianPrice ?? null,
        // psa10MedianPrice: row.psa10MedianPrice ?? null,
        // psa8SaleCount: row.psa8SaleCount ?? null,
        // psa9SaleCount: row.psa9SaleCount ?? null,
        // psa10SaleCount: row.psa10SaleCount ?? null
    }));

    if (dataForPrisma.length > 0) {
        console.log(
            `  ⏳ Upserting ${dataForPrisma.length} history entries for card ${myCardId}...`
        );
        let processedCount = 0;
        for (const row of dataForPrisma) {
            try {
                await prisma.priceHistory.upsert({
                    where: {
                        cardId_timestamp: {
                            cardId: row.cardId,
                            timestamp: row.timestamp
                        }
                    },
                    update: row,
                    create: row
                });
                processedCount++;
            } catch (upsertError) {
                console.error(
                    ` ❌ FAILED to upsert history for ${myCardId} on ${row.timestamp}:`,
                    upsertError.message
                );
                throw upsertError;
            }
        }
        console.log(` ✅ Processed ${processedCount} history entries for card ${myCardId}`);
        // try {
        //     const result = await prisma.priceHistory.createMany({
        //         data: dataForPrisma,
        //         skipDuplicates: true
        //     });
        //     console.log(`  ✅ Saved ${result.count} history entries for card ${myCardId}`);
        // } catch (error) {
        //     console.error(`  ❌ FAILED to write history for ${myCardId}:`, error.message);
        //     throw error;
        // }
    }
    const prices = apiCard.prices?.conditions;
    const latestNearMintPrice = prices?.['Near Mint']?.price;
    const latestLightlyPlayedPrice = prices?.['Lightly Played']?.price;
    const latestModeratelyPlayedPrice = prices?.['Moderately Played']?.price;
    const latestHeavilyPlayedPrice = prices?.['Heavily Played']?.price;
    const latestDamagedPrice = prices?.['Damaged']?.price;
    const tcgLastUpdatedAt = apiCard.prices?.lastUpdated;
    const validTcgUpdatedAt = tcgLastUpdatedAt ? new Date(tcgLastUpdatedAt) : undefined;

    try {
        await prisma.marketStats.upsert({
            where: { cardId: myCardId },
            update: {
                tcgNearMintLatest: latestNearMintPrice,
                tcgLightlyPlayedLatest: latestLightlyPlayedPrice ?? null,
                tcgModeratelyPlayedLatest: latestModeratelyPlayedPrice ?? null,
                tcgHeavilyPlayedLatest: latestHeavilyPlayedPrice ?? null,
                tcgDamagedLatest: latestDamagedPrice ?? null,
                tcgPlayerUpdatedAt: validTcgUpdatedAt
            },
            create: {
                cardId: myCardId,
                tcgNearMintLatest: latestNearMintPrice,
                tcgLightlyPlayedLatest: latestLightlyPlayedPrice ?? null,
                tcgModeratelyPlayedLatest: latestModeratelyPlayedPrice ?? null,
                tcgHeavilyPlayedLatest: latestHeavilyPlayedPrice ?? null,
                tcgDamagedLatest: latestDamagedPrice ?? null,
                tcgPlayerUpdatedAt: validTcgUpdatedAt ?? new Date()
                // PSA fields will be null by default
            }
        });
        console.log(` 📊 Upserted MarketStats for card ${myCardId}`);
    } catch (error) {
        console.error(` ❌ FAILED to upsert MarketStats for ${myCardId}:`, error.message);
        throw error;
    }
}

function normalizePokemonName(name: string): string {
    return (
        name
            .toLowerCase()
            .replace(/lv\.x/g, 'level x') // Handle Lv.X variations
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

async function main() {
    let completedSetIds = new Set<string>();
    try {
        if (fs.existsSync(COMPLETED_SETS_FILE)) {
            const fileContent = fs.readFileSync(COMPLETED_SETS_FILE, 'utf-8');
            completedSetIds = new Set(fileContent.split('\n').filter((id) => id.trim() !== ''));
            console.log(`Loaded ${completedSetIds.size} completed set IDs from file.`);
        } else {
            console.log(`'${COMPLETED_SETS_FILE}' not found, creating it.`);
            fs.writeFileSync(COMPLETED_SETS_FILE, '');
        }
    } catch (error) {
        console.error(`Error reading or creating completed sets file: `, error);
        process.exit(1);
    }

    const dbSets = await getSets();
    console.log(`Found ${dbSets.length - completedSetIds.size} sets to process.`);

    for (const set of dbSets) {
        if (completedSetIds.has(set.id)) {
            console.log(`Skipping already completed set: ${set.name} (${set.id})`);
            continue;
        }

        if (!set.tcgPlayerSetId) {
            console.log(`Skipping set ${set.name} (${set.id}) due to missing tcgPlayerSetId.`);
            continue;
        }

        console.log(`\nProcessing set: ${set.name} (${set.id})...`);
        const setPriceHistory = await getSetPriceHistory(set.tcgPlayerSetId, set.name);
        if (!setPriceHistory) {
            console.log(` -> Set fetch failed for ${set.name}. Will retry on next run.`);
            continue;
        }
        const apiCards = setPriceHistory.data;
        const cardsFetched = apiCards.length;

        if (!apiCards) {
            console.warn(` ⚠️  No 'data' array found for set ${set.name}. Skipping.`);
            try {
                fs.appendFileSync(COMPLETED_SETS_FILE, `${set.id}\n`);
                console.log(
                    ` ✅  Marked set ${set.name} (${set.id}) as completed (no cards found).`
                );
            } catch (error) {
                console.error(`Error writing completed set ID to file for set ${set.id}:`, error);
            }
            continue;
        }
        console.log(` Found ${apiCards.length} cards in API response for ${set.name}.`);
        console.log(` Fetching ${set.name} cards from local DB...`);

        const dbCards = await prisma.card.findMany({
            where: { setId: set.id },
            select: {
                id: true,
                number: true,
                name: true
            }
        });

        let setProcessingFullySuccessful = true;
        for (const apiCard of apiCards) {
            const apiCardNumberRaw = String(apiCard.cardNumber);
            const apiCardName = apiCard.name;
            const normalizedApiCardName = normalizePokemonName(apiCardName);
            const normalizedApiNumberString = apiCardNumberRaw.split('/')[0].replace(/^0+/, '');
            const myCard = dbCards.find((c) => c.number === normalizedApiNumberString);

            let cardMatchIsValid = false;
            if (!myCard) {
                console.log(
                    ` - ℹ️  No match found for API card number: '${apiCardNumberRaw}' (${apiCardName})`
                );
                continue;
            }
            const normalizedDbCardName = normalizePokemonName(myCard.name);
            if (
                normalizedDbCardName.includes(normalizedApiCardName) ||
                normalizedApiCardName.includes(normalizedDbCardName)
            ) {
                console.log(
                    ` ✅  Match found! DB: ${myCard.number} (${myCard.name}), API: ${apiCardNumberRaw} (${apiCardName})`
                );
                cardMatchIsValid = true;
            } else {
                // Number match but names don't
                console.log(
                    ` - ⚠️  Number match (${myCard.number} ends with ${normalizedApiNumberString}), but normalized names differ! DB_norm: '${normalizedDbCardName}', API_norm: '${normalizedApiCardName}'. Skipping.`
                );
            }
            if (!cardMatchIsValid) {
                continue;
            }
            try {
                await processAndWriteHistory(myCard!.id, myCard!.number, apiCard);
            } catch (error) {
                console.error(
                    ` ❌  Error processing history write for card ${apiCard.cardNumber} (${apiCardName}) in set ${set.name}:`,
                    error
                );
                setProcessingFullySuccessful = false;
            }
        }
        if (setProcessingFullySuccessful) {
            try {
                fs.appendFileSync(COMPLETED_SETS_FILE, `${set.id}\n`);
                console.log(` ✅  Marked set ${set.name} (${set.id}) as completed.`);
            } catch (error) {
                console.error(`Error writing completed set ID to file for set ${set.id}:`, error);
            }
        } else {
            console.log(
                ` -> Set ${set.name} (${set.id}) processing incomplete due to errors. Will retry remaining/failed cards on next run.`
            );
        }
        console.log(` -> Fetched ${cardsFetched} cards. Waiting 31s...`);
        await new Promise((resolve) => setTimeout(resolve, 31000));
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
