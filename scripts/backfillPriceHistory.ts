import { PrismaClient } from '@prisma/client';
import axios, { AxiosError } from 'axios';
import fs from 'fs';
import path from 'path';
import {
    ApiCard,
    VARIANT_MAPPINGS,
    ApiHistoryEntry,
    resolveBestNearMint
} from '../src/shared-types/price-api';

const POKEPRICETRACKER_KEY = process.env.POKEPRICETRACKER_KEY;
const prisma = new PrismaClient();
const API_BASE_URL = 'https://www.pokemonpricetracker.com/api/v2/cards/';
const COMPLETED_SETS_FILE = path.join(__dirname, '_completed_backfill_sets.txt');

// CONFIG
const MAX_CONCURRENT_WRITES = 6;

let rateLimitCount = 0;
let consecutive429s = 0;

const MAX_TOTAL_429S = 25;        // total allowed before aborting
const MAX_CONSECUTIVE_429S = 5;   // burst protection


const IGNORED_TERMS = [
    'Booster Box', 'Booster Pack', 'Elite Trainer Box', 'ETB',
    'Theme Deck', 'League Battle Deck', 'Premium Collection',
    'Special Collection', 'Pin Collection', 'Blister Pack'
];

type WorkingPriceRow = {
    timestamp: Date;
    tcgNearMint?: number | null;
    tcgNormal?: number | null;
    tcgHolo?: number | null;
    tcgReverse?: number | null;
    tcgFirstEdition?: number | null;
};


async function getSets() {
    const dbSets = await prisma.set.findMany({
        select: { id: true, tcgPlayerNumericId: true, name: true }
    });
    return dbSets;
}

async function getSetPriceHistory(set: string) {
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
        consecutive429s = 0;
        return response.data;
    } catch (error: unknown) {

        if (axios.isAxiosError(error)) {

            const status = error.response?.status;

            // --- Handle Rate Limit ---
            if (status === 429) {
                rateLimitCount++;
                consecutive429s++;

                const retryAfterHeader = error.response?.headers?.['retry-after'];
                const retryAfterSeconds =
                    typeof retryAfterHeader === 'string'
                        ? Number(retryAfterHeader)
                        : 10;

                console.warn(
                    `⚠️ 429 Rate Limit (Total: ${rateLimitCount}, Consecutive: ${consecutive429s})`
                );

                if (rateLimitCount >= MAX_TOTAL_429S) {
                    throw new Error(
                        `Too many total 429s (${rateLimitCount}). Aborting to avoid ban.`
                    );
                }

                if (consecutive429s >= MAX_CONSECUTIVE_429S) {
                    throw new Error(
                        `Too many consecutive 429s (${consecutive429s}). Likely hard throttled.`
                    );
                }

                // Optional exponential backoff
                const backoffDelay =
                    retryAfterSeconds * Math.pow(2, consecutive429s - 1);

                console.log(`⏳ Backing off for ${backoffDelay}s...`);

                await new Promise((r) =>
                    setTimeout(r, backoffDelay * 1000)
                );

                return getSetPriceHistory(set); // retry
            }

            // --- Other Axios errors ---
            console.error(
                `❌ Axios error for set ${set}:`,
                status,
                error.message
            );

            return null;
        }

        // --- Non-Axios errors ---
        if (error instanceof Error) {
            console.error(`❌ General error for set ${set}:`, error.message);
        } else {
            console.error(`❌ Unknown thrown value for set ${set}:`, error);
        }

        return null;
    }
}

async function processAndWriteHistory(myCardId: string, apiCard: ApiCard) {
    const entriesByDate = new Map<string, WorkingPriceRow>();
    const historyRoot = apiCard.priceHistory || {};

    // Get variant price history
    for (const mapping of VARIANT_MAPPINGS) {
        let historyArray: ApiHistoryEntry[] = [];

        for (const variantKey of mapping.apiKeys) {
            if (historyRoot.variants?.[variantKey]) {
                const variantObj = historyRoot.variants[variantKey];
                const nmData = variantObj['Near Mint'] || variantObj['Near Mint Holofoil'] || variantObj['Near Mint Reverse Holofoil'];
                if (nmData?.history && nmData.history.length > 0) {
                    historyArray = nmData.history;
                    break;
                }
            }
        }

        if (historyArray.length > 0) {
            const columnKey = mapping.dbColumn;
            for (const historyItem of historyArray) {
                const dateString = historyItem.date;
                if (!entriesByDate.has(dateString)) {
                    entriesByDate.set(dateString, { timestamp: new Date(dateString) });
                }
                const row = entriesByDate.get(dateString)!;
                const market = Number(historyItem.market);
                if (!isNaN(market)) {
                    row[columnKey] = market;
                }
            }
        }
    }

    // Get nearMint/raw price history
    const rawMarketHistory = historyRoot.conditions?.['Near Mint']?.history;
    if (rawMarketHistory && rawMarketHistory.length > 0) {
        for (const historyItem of rawMarketHistory) {
            const dateString = historyItem.date;
            if (!entriesByDate.has(dateString)) {
                entriesByDate.set(dateString, { timestamp: new Date(dateString) });
            }
            const row = entriesByDate.get(dateString)!;
            const market = Number(historyItem.market);
            if (!isNaN(market)) {
                row.tcgNearMint = market;
            }
        }
    }

    // If tcgNearMint missing for a date, derive from variants
    for (const row of entriesByDate.values()) {
        row.tcgNearMint = resolveBestNearMint(
            row.tcgNearMint,
            row.tcgNormal,
            row.tcgHolo,
            row.tcgReverse,
            row.tcgFirstEdition
        );
    }

    const dataForPrisma = Array.from(entriesByDate.values()).map((row) => ({
        cardId: myCardId,
        timestamp: row.timestamp!,
        tcgNearMint: row.tcgNearMint,
        tcgNormal: row.tcgNormal,
        tcgHolo: row.tcgHolo,
        tcgReverse: row.tcgReverse,
        tcgFirstEdition: row.tcgFirstEdition,
    }));

    if (dataForPrisma.length > 0) {
        const operations = dataForPrisma.map((row) => 
            prisma.priceHistory.upsert({
                where: { cardId_timestamp: { cardId: row.cardId, timestamp: row.timestamp } },
                update: {
                    tcgNearMint: row.tcgNearMint,
                    tcgNormal: row.tcgNormal,
                    tcgHolo: row.tcgHolo,
                    tcgReverse: row.tcgReverse,
                    tcgFirstEdition: row.tcgFirstEdition
                },
                create: {
                    cardId: row.cardId,
                    timestamp: row.timestamp,
                    tcgNearMint: row.tcgNearMint,
                    tcgNormal: row.tcgNormal,
                    tcgHolo: row.tcgHolo,
                    tcgReverse: row.tcgReverse,
                    tcgFirstEdition: row.tcgFirstEdition
                }
            })
        );

        // Execute all 100+ updates for this card in ONE database transaction
        await prisma.$transaction(operations);
    }

    // Update current market stats (same day price)
    let currentMarketPrice = apiCard.prices?.market ?? null;
    const metaVariants = apiCard.variants || {}; 
    
    const getVariantPrice = (keysToCheck: string[]) => {
        for (const key of keysToCheck) {
            const data = metaVariants[key];
            if (data && typeof data.marketPrice === 'number') return data.marketPrice;
        }
        return null;
    };

    const pNormal = getVariantPrice(["Normal"]);
    const pHolo = getVariantPrice(["Holofoil"]);
    const pReverse = getVariantPrice(["Reverse Holofoil", "Reverse"]);
    const p1stEd = getVariantPrice(["1st Edition", "1st Edition Holofoil"]);

    const tcgLastUpdatedAt = apiCard.prices?.lastUpdated;
    const validTcgUpdatedAt = tcgLastUpdatedAt ? new Date(tcgLastUpdatedAt) : undefined;


    currentMarketPrice = resolveBestNearMint(
        currentMarketPrice,
        pNormal,
        pHolo,
        pReverse,
        p1stEd
    );


    await prisma.marketStats.upsert({
        where: { cardId: myCardId },
        update: {
            tcgNearMintLatest: currentMarketPrice,
            tcgNormalLatest: pNormal,
            tcgHoloLatest: pHolo,
            tcgReverseLatest: pReverse,
            tcgFirstEditionLatest: p1stEd,
            tcgPlayerUpdatedAt: validTcgUpdatedAt
        },
        create: {
            cardId: myCardId,
            tcgNearMintLatest: currentMarketPrice,
            tcgNormalLatest: pNormal,
            tcgHoloLatest: pHolo,
            tcgReverseLatest: pReverse,
            tcgFirstEditionLatest: p1stEd,
            tcgPlayerUpdatedAt: validTcgUpdatedAt ?? new Date()
        }
    });
}

// Helper: Normalize names ---
function normalizePokemonName(name: string): string {
    return name
        .toLowerCase()
        .replace(/lv\.x/g, 'levelx')
        .replace(/ ★/g, 'star')
        .replace(/ δ/g, 'deltaspecies')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s]|_/g, '')
        .replace(/\s+/g, '')
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
        if (!set.tcgPlayerNumericId) {
            console.log(`Skipping set ${set.name} (No Numeric TCGPlayer ID)`);
            continue;
        }

        console.log(`\nProcessing: ${set.name} (${set.id})...`);
        const setPriceHistory = await getSetPriceHistory(String(set.tcgPlayerNumericId));
        if (!setPriceHistory || !setPriceHistory.data) {
            console.log(` -> Failed/Empty response. Skipping.`);
            continue;
        }

        const apiCards: ApiCard[] = setPriceHistory.data;
        const dbCards = await prisma.card.findMany({
            where: { setId: set.id },
            select: { id: true, number: true, name: true, setId: true }
        });

        const validApiCards = apiCards.filter((c) => {
            if (!c.cardNumber || String(c.cardNumber).trim() === '') return false;
            if (c.name.includes('Code Card')) return false;
            const isIgnored = IGNORED_TERMS.some((term) => c.name.includes(term));
            return !isIgnored;
        });

        const ignoredCount = apiCards.length - validApiCards.length;
        console.log(` -> API Items: ${apiCards.length} (${ignoredCount} ignored)`);
        console.log(` -> Valid Cards to Sync: ${validApiCards.length} | DB Cards: ${dbCards.length}`);

        let setProcessingFullySuccessful = true;
        const pendingPromises: Promise<void>[] = [];
        let processedCount = 0;
        let skippedCount = 0;
        
        const skipStats = { noMatch: 0, mismatch: 0 };
        const processedCardIds = new Set<string>();

        const dbCardMap = new Map<string, typeof dbCards[0]>();
        dbCards.forEach(c => {
             const cleanNum = c.number.split('/')[0].replace(/^0+/, '').trim();
             dbCardMap.set(cleanNum, c);
        });

        for (const apiCard of validApiCards) {
            const apiNumClean = String(apiCard.cardNumber).split('/')[0].replace(/^0+/, '');

            let myCard = dbCardMap.get(apiNumClean);

            if (!myCard) {
                myCard = dbCards.find((c) => {
                    const dbNumClean = c.number.split('/')[0].replace(/^0+/, '').trim();
                    return dbNumClean === apiNumClean;
                });
            }

            if (!myCard) {
                skippedCount++;
                skipStats.noMatch++;
                continue;
            }

            const apiNameClean = apiCard.name.replace(/\s*\([^)]*\)\s*/g, '').trim();
            const nApiName = normalizePokemonName(apiNameClean);
            const nDbName = normalizePokemonName(myCard.name);
            const namesMatch = nDbName.includes(nApiName) || nApiName.includes(nDbName);

            if (!namesMatch) {
                skippedCount++;
                skipStats.mismatch++;
                continue;
            }

            if (processedCardIds.has(myCard.id)) continue;
            processedCardIds.add(myCard.id);

            const op = processAndWriteHistory(myCard.id, apiCard)
                .then(() => {
                    processedCount++;
                    if (processedCount % 10 === 0) {
                        process.stdout.write(`\r  [${processedCount}/${validApiCards.length}] Syncing...`);
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

        console.log(`\n  ✅ Report: ${processedCount} Updated | ${skippedCount} Skipped`);
        console.log(`  (Skip Details: NoMatch=${skipStats.noMatch}, Mismatch=${skipStats.mismatch})`);

        const matchedAllCards = processedCount >= (dbCards.length * 0.95); 
        
        if (setProcessingFullySuccessful && matchedAllCards) {
            fs.appendFileSync(COMPLETED_SETS_FILE, `${set.id}\n`);
            console.log(` ✅ DONE: ${set.name} marked as complete.`);
        } else {
            console.log(` ⚠️ INCOMPLETE: ${set.name} - Only ${processedCount}/${dbCards.length} matched.`);
        }

        const waitTime = Math.ceil(validApiCards.length / 10) + 4;
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