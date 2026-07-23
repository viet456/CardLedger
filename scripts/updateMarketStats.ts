import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';
import TCGdex from '@tcgdex/sdk';
import axios from 'axios';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';
import zlib from 'zlib';
import crypto from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
    adapter,
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

    try {
        await incrementHistoryIndex();
    } catch (err) {
        console.error('❌ Failed to increment history index:', err);
    }
}

/**
 * Incrementally updates the R2-hosted price history artifacts by appending
 * a new date column and incorporating any new cards that appeared since
 * the last run.
 *
 * ## R2 Data Format
 *
 * Two files are stored on R2 and downloaded by the client on page load:
 *
 * - **Index JSON** (`history-index.v*.json`)
 *   - `dates[]` — every calendar day from the earliest price to the latest,
 *     as ISO strings ("2024-01-15", "2024-01-16", …).
 *   - `offsets` — `cardId → variant → int32ElementOffset` pointing into the
 *     monolithic binary file. Each offset is the *element* index (not byte)
 *     where that card/variant's delta array starts.
 *
 * - **Binary data** (`history-data.v*.bin`)
 *   - A single `Int32Array`. For each card+variant the array stores one
 *     Int32 value per date in `dates[]`:
 *       • Day 0 → absolute price in cents
 *       • Day 1+ → delta from previous day's running price
 *   - The client accumulates deltas to reconstruct the full price series.
 *
 * ## What this function does
 *
 * 1. Downloads the existing R2 artifacts.
 * 2. Finds the newest date in the DB that isn't already in `dates[]`.
 * 3. Fetches that day's prices for all cards from the DB.
 * 4. Identifies **new cards** (in DB but missing from R2 offsets) and
 *    fetches their complete history so we can build delta arrays from
 *    scratch — no full rebuild of all 4.5M rows needed.
 * 5. Builds a new buffer in a single unified pass over every card:
 *    - Existing cards: copy old deltas from the R2 buffer, append new delta.
 *    - New cards: build full delta array from DB history.
 * 6. Uploads the updated artifacts to R2.
 */
async function incrementHistoryIndex() {
    console.log('--- Starting Incremental History Update ---');

    const BUCKET_NAME = 'cardledger';
    const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

    // ── Step 1: Fetch current R2 artifacts ────────────────────────────────────
    // The pointer file always points to the latest versioned index + data files.
    const pointerRes = await fetch(`${R2_PUBLIC_URL}/history/history-index.current.json`);
    if (!pointerRes.ok) throw new Error('Could not fetch pointer file');
    const pointer = await pointerRes.json();

    const indexRes = await fetch(pointer.indexUrl);
    const dataRes = await fetch(pointer.dataUrl);
    if (!indexRes.ok || !dataRes.ok) throw new Error('Could not fetch history files');

    const indexData = await indexRes.json();
    const dataBuffer = await dataRes.arrayBuffer();
    const oldInt32Array = new Int32Array(dataBuffer);

    // ── Step 2: Determine the target date to append ───────────────────────────
    // We use the source's reported date (from TCGdex/TCGPlayer) rather than
    // new Date(), because the API's `updated` field can lag behind the script
    // run date. This ensures the history index date aligns with the actual
    // price data timestamps stored in the DB.
    const latestRecord = await prisma.priceHistory.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true }
    });
    if (!latestRecord) {
        console.log('No price history found in DB. Skipping increment.');
        return;
    }
    const latestDate = new Date(latestRecord.timestamp);
    latestDate.setHours(0, 0, 0, 0);
    const latestDateStr = latestDate.toISOString().split('T')[0];

    if (indexData.dates[indexData.dates.length - 1] === latestDateStr) {
        console.log(`History already has latest date (${latestDateStr}). Skipping increment.`);
        return;
    }

    // ── Step 3: Fetch the new day's prices for all cards ──────────────────────
    // This gives us the latest price snapshot to append as a new delta column.
    console.log(`Querying prices from DB for ${latestDateStr}...`);
    const latestPrices = await prisma.priceHistory.findMany({
        where: { timestamp: { gte: latestDate } },
        select: {
            cardId: true,
            tcgNearMint: true,
            tcgNormal: true,
            tcgHolo: true,
            tcgReverse: true,
            tcgFirstEdition: true
        }
    });

    const priceMap = new Map<string, typeof latestPrices[0]>();
    for (const row of latestPrices) {
        priceMap.set(row.cardId, row);
    }
    console.log(`Found ${latestPrices.length} cards with prices for ${latestDateStr}.`);

    // ── Step 4: Identify new cards and fetch their full history ────────────────
    // New cards are present in the DB's priceHistory table but have no entry in
    // the R2 index's offsets map. We need their complete history to build delta
    // arrays from scratch (the R2 buffer has nothing for them).
    const offsetsObj = indexData.offsets as Record<string, Record<string, number>>;
    const newCardIds = Array.from(priceMap.keys()).filter(id => !(id in offsetsObj));

    // newCardHistory[cardId][dateStr] → { variant: priceInDollars | null }
    const newCardHistory = new Map<string, Record<string, Record<string, number | null>>>();

    if (newCardIds.length > 0) {
        console.log(`Found ${newCardIds.length} new cards not in history index. Fetching their history from DB...`);

        const CHUNK_SIZE = 500;
        for (let i = 0; i < newCardIds.length; i += CHUNK_SIZE) {
            const chunk = newCardIds.slice(i, i + CHUNK_SIZE);
            const records = await prisma.priceHistory.findMany({
                where: { cardId: { in: chunk } },
                select: {
                    cardId: true,
                    timestamp: true,
                    tcgNearMint: true,
                    tcgNormal: true,
                    tcgHolo: true,
                    tcgReverse: true,
                    tcgFirstEdition: true
                },
                orderBy: { timestamp: 'asc' }
            });

            for (const r of records) {
                const dateStr = new Date(r.timestamp).toISOString().split('T')[0];
                if (!newCardHistory.has(r.cardId)) {
                    newCardHistory.set(r.cardId, {});
                }
                newCardHistory.get(r.cardId)![dateStr] = {
                    tcgNearMint: r.tcgNearMint !== null ? Number(r.tcgNearMint) : null,
                    tcgNormal: r.tcgNormal !== null ? Number(r.tcgNormal) : null,
                    tcgHolo: r.tcgHolo !== null ? Number(r.tcgHolo) : null,
                    tcgReverse: r.tcgReverse !== null ? Number(r.tcgReverse) : null,
                    tcgFirstEdition: r.tcgFirstEdition !== null ? Number(r.tcgFirstEdition) : null
                };
            }
        }
        console.log(`Fetched history for ${newCardHistory.size} new cards.`);
    }

    // ── Step 5: Build the new buffer and offsets ──────────────────────────────
    // We iterate all cards in a single unified pass. Each card+variant produces
    // exactly (oldDatesLen + 1) Int32 entries: the original deltas plus one new
    // delta for the appended date.
    //
    // Uses a dynamic array (number[]) because the final size depends on how
    // many new-card variants have data. Converted to Int32Array at the end.
    const variantKeys = ['tcgNearMint', 'tcgNormal', 'tcgHolo', 'tcgReverse', 'tcgFirstEdition'] as const;
    const oldDatesLen = indexData.dates.length;
    const newDates = [...indexData.dates, latestDateStr]; // all dates including the new one
    const totalNewDates = newDates.length;

    const buffer: number[] = [];
    const newOffsets: Record<string, Record<string, number>> = {};
    let newCardVariantCount = 0;

    // Union of every card we need to process: those already in the R2 index
    // plus those that are new in this run.
    const allCardIds = new Set([
        ...Object.keys(offsetsObj),
        ...priceMap.keys()
    ]);

    for (const cardId of allCardIds) {
        const isExisting = cardId in offsetsObj;
        const latestDayData = priceMap.get(cardId);
        const cardHistory = newCardHistory.get(cardId);

        if (isExisting) {
            // ── Existing card: copy old deltas, append new delta ──────────
            // The R2 buffer already has this card's full history. We copy
            // those deltas verbatim, then compute the delta for the new
            // date (latestDayData price minus last accumulated price).
            const cardOffsets = offsetsObj[cardId];
            newOffsets[cardId] = {};

            for (const variant of variantKeys) {
                const oldStart = cardOffsets[variant];
                if (oldStart === undefined) continue;

                newOffsets[cardId][variant] = buffer.length;

                let lastRunningPrice = 0;

                // Copy old deltas and accumulate to find the last known price
                for (let i = 0; i < oldDatesLen; i++) {
                    const delta = oldInt32Array[oldStart + i];
                    buffer.push(delta);
                    lastRunningPrice += delta;
                }

                // Compute delta for the new date
                let newDelta = 0;
                if (latestDayData && (latestDayData as any)[variant] !== null) {
                    const currentPriceCents = Math.round(Number((latestDayData as any)[variant]) * 100);
                    newDelta = currentPriceCents - lastRunningPrice;
                }
                buffer.push(newDelta);
            }
        } else {
            // ── New card: build full delta array from DB history ──────────
            // This card wasn't in the previous R2 index at all. We build
            // its delta arrays from scratch using the DB records fetched
            // in Step 4.
            //
            // Delta encoding rules (same as generateHistoryIndex.ts):
            //   • Day 0: absolute price in cents (or 0 if no record yet)
            //   • Day 1+: delta from previous running price
            //   • Dates before the card's first price record produce
            //     delta=0, so the running price stays at 0 until data
            //     appears.
            if (!cardHistory) continue;

            newOffsets[cardId] = {};
            let hasAnyVariant = false;

            for (const variant of variantKeys) {
                // Skip variants that have zero non-null prices across all dates
                const hasData = newDates.some(d => cardHistory[d] && cardHistory[d][variant] !== null);
                if (!hasData) continue;

                hasAnyVariant = true;
                newOffsets[cardId][variant] = buffer.length;
                newCardVariantCount++;

                let lastPriceCents = 0;

                for (let i = 0; i < totalNewDates; i++) {
                    const dateStr = newDates[i];
                    const record = cardHistory[dateStr];

                    let currentPriceCents = lastPriceCents;
                    if (record && record[variant] !== null) {
                        currentPriceCents = Math.round(record[variant]! * 100);
                    }

                    // Day 0 = absolute price, Days 1+ = delta
                    if (i === 0) {
                        buffer.push(currentPriceCents);
                    } else {
                        buffer.push(currentPriceCents - lastPriceCents);
                    }

                    lastPriceCents = currentPriceCents;
                }
            }

            // Clean up if no variants had data (shouldn't happen since we
            // filtered to cards in priceMap, but be safe)
            if (!hasAnyVariant) {
                delete newOffsets[cardId];
            }
        }
    }

    console.log(` -> Processed ${allCardIds.size} total cards (${Object.keys(offsetsObj).length} existing + ${newCardIds.length} new, ${newCardVariantCount} new variant columns).`);

    // ── Step 6: Upload updated artifacts to R2 ───────────────────────────────
    indexData.dates = newDates;
    indexData.offsets = newOffsets;

    const version = new Date().toISOString().replace(/[-:.]/g, '');
    indexData.version = version;

    const int32Array = new Int32Array(buffer);
    const binaryBufferToUpload = Buffer.from(int32Array.buffer);
    const indexJsonStr = JSON.stringify(indexData);

    const compressedBinary = zlib.brotliCompressSync(binaryBufferToUpload);
    const compressedIndex = zlib.brotliCompressSync(Buffer.from(indexJsonStr, 'utf-8'));

    const dataCheckSum = crypto.createHash('sha256').update(binaryBufferToUpload).digest('hex');
    const indexCheckSum = crypto.createHash('sha256').update(indexJsonStr).digest('hex');

    const dataFileName = `history-data.v${version}.bin.br`;
    const indexFileName = `history-index.v${version}.json.br`;

    console.log(` -> Binary uncompressed size: ${(binaryBufferToUpload.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(` -> Binary Brotli compressed size: ${(compressedBinary.length / 1024 / 1024).toFixed(2)} MB`);

    console.log(` -> Uploading data artifact to R2: ${dataFileName}`);
    await r2.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `history/${dataFileName}`,
        Body: compressedBinary,
        ContentType: 'application/octet-stream',
        ContentEncoding: 'br',
        CacheControl: 'public, max-age=86400, immutable'
    }));

    console.log(` -> Uploading index artifact to R2: ${indexFileName}`);
    await r2.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `history/${indexFileName}`,
        Body: compressedIndex,
        ContentType: 'application/json',
        ContentEncoding: 'br',
        CacheControl: 'public, max-age=86400, immutable'
    }));

    // The pointer file always points to the latest version. Clients fetch
    // this first, then download the versioned index + data files it references.
    const pointerFile = {
        version,
        indexUrl: `${R2_PUBLIC_URL}/history/${indexFileName}`,
        dataUrl: `${R2_PUBLIC_URL}/history/${dataFileName}`,
        indexCheckSum,
        dataCheckSum,
        cardCount: Object.keys(indexData.offsets).length,
        updatedAt: new Date().toISOString()
    };

    const pointerFileName = 'history-index.current.json';
    console.log(`-> Uploading pointer file to R2: ${pointerFileName}`);
    await r2.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `history/${pointerFileName}`,
        Body: JSON.stringify(pointerFile),
        ContentType: 'application/json',
        CacheControl: 'public, max-age=300'
    }));

    console.log(' -> ✅ Incremental history artifacts uploaded successfully');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
