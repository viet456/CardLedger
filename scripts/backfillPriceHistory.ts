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
const COMPLETED_SETS_FILE = path.join(__dirname, '_completed_backfill_sets.txt');

// CONFIG
const MAX_CONCURRENT_WRITES = 5;
const DEBUG_CARD_NUMBER = '215';

const IGNORED_TERMS = [
    'Booster Box',
    'Booster Pack',
    'Elite Trainer Box',
    'ETB',
    'Theme Deck',
    'League Battle Deck',
    'Premium Collection',
    'Special Collection',
    'Pin Collection',
    'Blister Pack'
];

async function getSets() {
    const dbSets = await prisma.set.findMany({
        select: { id: true, tcgPlayerSetId: true, name: true }
    });
    return dbSets;
}

async function getSetPriceHistory(set: string, setName: string) {
    try {
        const response = await axios.get(`${API_BASE_URL}`, {
            headers: { Authorization: `Bearer ${POKEPRICETRACKER_KEY}` },
            params: {
                setId: `${set}`,
                fetchAllInSet: true,
                includeHistory: true,
                days: 9999
            },
            timeout: 60000
        });
        if (!response.data || !response.data.data) {
            console.warn(`⚠️ No data found in API response for set ${setName} (${set})`);
            return null;
        }
        return response.data;
    } catch (error) {
        console.error(
            ` ❌ FAILED to fetch data for ${set}:`,
            error instanceof Error ? error.message : error
        );
        return null;
    }
}

async function processAndWriteHistory(myCardId: string, apiCard: ApiCard) {
    const entriesByDate = new Map<string, Partial<PriceHistoryDbRow>>();

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

            if (!isNaN(market)) row[marketKey] = market;
            if (volume !== null && !isNaN(volume)) row[volumeKey] = volume;
        }
    }

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
    }));

    if (dataForPrisma.length > 0) {
        for (const row of dataForPrisma) {
            await prisma.priceHistory.upsert({
                where: { cardId_timestamp: { cardId: row.cardId, timestamp: row.timestamp } },
                update: row,
                create: row
            });
        }
    }

    const prices = apiCard.prices?.conditions;
    const tcgLastUpdatedAt = apiCard.prices?.lastUpdated;
    const validTcgUpdatedAt = tcgLastUpdatedAt ? new Date(tcgLastUpdatedAt) : undefined;

    await prisma.marketStats.upsert({
        where: { cardId: myCardId },
        update: {
            tcgNearMintLatest: prices?.['Near Mint']?.price,
            tcgLightlyPlayedLatest: prices?.['Lightly Played']?.price ?? null,
            tcgModeratelyPlayedLatest: prices?.['Moderately Played']?.price ?? null,
            tcgHeavilyPlayedLatest: prices?.['Heavily Played']?.price ?? null,
            tcgDamagedLatest: prices?.['Damaged']?.price ?? null,
            tcgPlayerUpdatedAt: validTcgUpdatedAt
        },
        create: {
            cardId: myCardId,
            tcgNearMintLatest: prices?.['Near Mint']?.price,
            tcgLightlyPlayedLatest: prices?.['Lightly Played']?.price ?? null,
            tcgModeratelyPlayedLatest: prices?.['Moderately Played']?.price ?? null,
            tcgHeavilyPlayedLatest: prices?.['Heavily Played']?.price ?? null,
            tcgDamagedLatest: prices?.['Damaged']?.price ?? null,
            tcgPlayerUpdatedAt: validTcgUpdatedAt ?? new Date()
        }
    });
}

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

async function main() {
    let completedSetIds = new Set<string>();
    try {
        if (fs.existsSync(COMPLETED_SETS_FILE)) {
            const fileContent = fs.readFileSync(COMPLETED_SETS_FILE, 'utf-8');
            completedSetIds = new Set(fileContent.split('\n').filter((id) => id.trim() !== ''));
            console.log(`Loaded ${completedSetIds.size} completed set IDs.`);
        } else {
            fs.writeFileSync(COMPLETED_SETS_FILE, '');
        }
    } catch (error) {
        console.error(`Error with completed sets file: `, error);
    }

    const dbSets = await getSets();
    console.log(`Found ${dbSets.length - completedSetIds.size} sets to process.`);

    for (const set of dbSets) {
        if (completedSetIds.has(set.id)) continue;
        if (!set.tcgPlayerSetId) {
            console.log(`Skipping set ${set.name} (No TCGPlayer ID)`);
            continue;
        }

        console.log(`\nProcessing: ${set.name} (${set.id})...`);
        const setPriceHistory = await getSetPriceHistory(set.tcgPlayerSetId, set.name);

        if (!setPriceHistory || !setPriceHistory.data) {
            console.log(` -> Failed/Empty response. Skipping.`);
            continue;
        }

        const apiCards: ApiCard[] = setPriceHistory.data;
        const dbCards = await prisma.card.findMany({
            where: { setId: set.id },
            select: { id: true, number: true, name: true, setId: true }
        });

        // FILTER: Ignore SEALED PRODUCT, but be careful not to ignore Cards
        const validApiCards = apiCards.filter((c) => {
            // Filter out items with no card number (code cards, promos, etc.)
            if (!c.cardNumber || String(c.cardNumber).trim() === '') {
                console.log(`    Filtered out (no number): ${c.name}`);
                return false;
            }

            // Filter out "Code Card" items
            if (c.name.includes('Code Card')) {
                console.log(`    Filtered out (code card): ${c.name}`);
                return false;
            }

            // Filter out known sealed product terms
            const isIgnored = IGNORED_TERMS.some((term) => c.name.includes(term));
            if (isIgnored) {
                console.log(`    Filtered out (sealed): ${c.name}`);
            }
            return !isIgnored;
        });
        const ignoredCount = apiCards.length - validApiCards.length;

        console.log(` -> API Items: ${apiCards.length} (${ignoredCount} ignored sealed items)`);
        console.log(
            ` -> Valid Cards to Sync: ${validApiCards.length} | DB Cards: ${dbCards.length}`
        );

        let setProcessingFullySuccessful = true;
        const pendingPromises: Promise<void>[] = [];
        let processedCount = 0;
        let skippedCount = 0;
        const skippedCards: Array<{ number: string; name: string; reason: string }> = [];

        for (const apiCard of validApiCards) {
            const isDebug = String(apiCard.cardNumber).includes(DEBUG_CARD_NUMBER);

            // 2. NUMBER MATCHING
            const apiNumClean = String(apiCard.cardNumber).split('/')[0].replace(/^0+/, '');

            const myCard = dbCards.find((c) => {
                const dbNumClean = c.number.split('/')[0].replace(/^0+/, '').trim();
                return dbNumClean === apiNumClean;
            });

            if (!myCard) {
                skippedCards.push({
                    number: String(apiCard.cardNumber),
                    name: apiCard.name,
                    reason: 'Card number not found in DB'
                });
                skippedCount++;
                continue;
            }

            // Strip parentheses from API name only (DB names typically don't have them)
            const apiNameClean = apiCard.name.replace(/\s*\([^)]*\)\s*/g, '').trim();

            // Normalize both for comparison
            const nApiName = normalizePokemonName(apiNameClean);
            const nDbName = normalizePokemonName(myCard.name);

            // Match if either name contains the other
            const namesMatch = nDbName.includes(nApiName) || nApiName.includes(nDbName);

            if (!namesMatch) {
                skippedCards.push({
                    number: String(apiCard.cardNumber),
                    name: apiCard.name,
                    reason: `Name mismatch: DB="${myCard.name}" (${nDbName}) vs API="${apiNameClean}" (${nApiName})`
                });
                skippedCount++;
                continue;
            } else {
                if (isDebug)
                    console.log(`\n[DEBUG] ✅ MATCH SUCCESS: ${myCard.name} <=> ${apiCard.name}`);
            }

            const op = processAndWriteHistory(myCard.id, apiCard)
                .then(() => {
                    processedCount++;
                    if (processedCount % 10 === 0 || processedCount === validApiCards.length) {
                        process.stdout.write(
                            `\r  [${processedCount}/${validApiCards.length}] Syncing...`
                        );
                    }
                })
                .catch((err) => {
                    console.error(`\n  ❌ Error on ${apiCard.name}: ${err.message}`);
                    setProcessingFullySuccessful = false;
                });

            pendingPromises.push(op);

            if (pendingPromises.length >= MAX_CONCURRENT_WRITES) {
                const oldest = pendingPromises.shift();
                if (oldest) await oldest;
            }
        }

        await Promise.all(pendingPromises);

        console.log(`\n  ✅ Final Report: ${processedCount} Updated | ${skippedCount} Skipped`);

        // Find which DB cards weren't matched
        const processedCardIds = new Set<string>();
        for (const apiCard of validApiCards) {
            const apiNumClean = String(apiCard.cardNumber).split('/')[0].replace(/^0+/, '');
            const myCard = dbCards.find((c) => {
                const dbNumClean = c.number.split('/')[0].replace(/^0+/, '').trim();
                return dbNumClean === apiNumClean;
            });
            if (myCard) {
                const apiNameClean = apiCard.name.replace(/\s*\([^)]*\)\s*/g, '').trim();
                const nApiName = normalizePokemonName(apiNameClean);
                const nDbName = normalizePokemonName(myCard.name);
                const namesMatch = nDbName.includes(nApiName) || nApiName.includes(nDbName);
                if (namesMatch) {
                    processedCardIds.add(myCard.id);
                }
            }
        }

        const unmatchedDbCards = dbCards.filter((c) => !processedCardIds.has(c.id));
        if (unmatchedDbCards.length > 0) {
            console.log(`\n  🚨 UNMATCHED DB CARDS (${unmatchedDbCards.length}):`);
            for (const card of unmatchedDbCards) {
                console.log(`    #${card.number} - ${card.name}`);
            }
        }

        // Print detailed skip report
        if (skippedCards.length > 0) {
            console.log(`\n  📋 SKIPPED API ITEMS (${skippedCards.length}):`);
            for (const skip of skippedCards) {
                console.log(`    #${skip.number} - ${skip.name}`);
            }
        }

        // Success if we matched all actual cards (skips are okay if they're sealed products)
        const matchedAllCards = processedCount === dbCards.length;

        if (setProcessingFullySuccessful && matchedAllCards) {
            fs.appendFileSync(COMPLETED_SETS_FILE, `${set.id}\n`);
            console.log(` ✅ DONE: ${set.name} marked as complete.`);
        } else {
            console.log(` ⚠️ INCOMPLETE: ${set.name} still has missing cards.`);
        }

        const waitTime = Math.ceil(validApiCards.length / 10) + 2;
        console.log(` ⏳ Cooling down for ${waitTime}s...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
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
