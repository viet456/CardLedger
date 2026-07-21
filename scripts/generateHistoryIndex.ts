import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';
import crypto from 'crypto';
import zlib from 'zlib';
import { HistoryIndex, HistoryPointerFile } from '../src/shared-types/price-api';

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const BUCKET_NAME = 'cardledger';

async function generateHistoryIndex() {
    console.log('Starting to build the offline price history artifact...');

    // Determine the dates 
    // Find the earliest and most recent timestamps in the PriceHistory table
    const latestHistory = await prisma.priceHistory.findFirst({
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true }
    });
    
    const earliestHistory = await prisma.priceHistory.findFirst({
        orderBy: { timestamp: 'asc' },
        select: { timestamp: true }
    });

    if (!latestHistory || !earliestHistory) {
        console.log('No price history found. Aborting.');
        return;
    }

    const latestDate = new Date(latestHistory.timestamp);
    latestDate.setHours(0, 0, 0, 0);
    
    const earliestDate = new Date(earliestHistory.timestamp);
    earliestDate.setHours(0, 0, 0, 0);

    const dates: string[] = [];
    let currentDate = new Date(earliestDate);
    
    while (currentDate <= latestDate) {
        dates.push(currentDate.toISOString().split('T')[0]);
        currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(` -> Total days to process: ${dates.length}`);
    console.log(` -> Fetching price history from ${dates[0]} to ${dates[dates.length - 1]}...`);

    // Fetch distinct card IDs
    const uniqueCards = await prisma.priceHistory.findMany({
        select: { cardId: true },
        distinct: ['cardId']
    });

    console.log(` -> Found ${uniqueCards.length} cards with history. Processing in chunks...`);

    const variantKeys = ['tcgNearMint', 'tcgNormal', 'tcgHolo', 'tcgReverse', 'tcgFirstEdition'] as const;

    const bufferArray: number[] = [];
    const offsets: Record<string, Record<string, number>> = {};
    let cardCount = 0;
    
    // Queries are heavy
    const CHUNK_SIZE = 500;
    
    for (let c = 0; c < uniqueCards.length; c += CHUNK_SIZE) {
        const chunkCardIds = uniqueCards.slice(c, c + CHUNK_SIZE).map(c => c.cardId);
        
        const chunkHistory = await prisma.priceHistory.findMany({
            where: {
                cardId: { in: chunkCardIds },
                timestamp: { gte: earliestDate }
            },
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
        
        // Group by cardId
        const historyByCard: Record<string, typeof chunkHistory> = {};
        for (const record of chunkHistory) {
            if (!historyByCard[record.cardId]) {
                historyByCard[record.cardId] = [];
            }
            historyByCard[record.cardId].push(record);
        }
        
        for (const [cardId, records] of Object.entries(historyByCard)) {
            // Create a map of date string -> record
            const recordMap: Record<string, typeof records[0]> = {};
            for (const r of records) {
                const d = new Date(r.timestamp).toISOString().split('T')[0];
                recordMap[d] = r;
            }

            const cardOffsets: Record<string, number> = {};
            let hasAnyVariant = false;

            for (const variant of variantKeys) {
                // Check if this variant has ANY non-null data in the entire date range
                const hasData = dates.some(d => recordMap[d] && recordMap[d][variant] !== null);
                if (!hasData) continue;

                // Start packing this variant
                hasAnyVariant = true;
                cardOffsets[variant] = bufferArray.length;

                let lastValidPriceCents = 0;

                for (let i = 0; i < dates.length; i++) {
                    const dateStr = dates[i];
                    const record = recordMap[dateStr];
                    
                    let currentPriceCents = lastValidPriceCents;
                    if (record && record[variant] !== null) {
                        currentPriceCents = Math.round(Number(record[variant]) * 100);
                    }

                    if (i === 0) {
                        // Day 0: Absolute price
                        bufferArray.push(currentPriceCents);
                    } else {
                        // Days 1-N: Delta encoding
                        bufferArray.push(currentPriceCents - lastValidPriceCents);
                    }

                    lastValidPriceCents = currentPriceCents;
                }
            }

            if (hasAnyVariant) {
                offsets[cardId] = cardOffsets;
                cardCount++;
            }
        }
        
        // Progress indicator
        if ((c + CHUNK_SIZE) % 5000 === 0) {
            console.log(`    ... processed ${Math.min(c + CHUNK_SIZE, uniqueCards.length)} cards`);
        }
    }

    console.log(` -> Processed ${cardCount} cards with active history.`);

    // Convert to Int32Array
    const int32Array = new Int32Array(bufferArray);
    const binaryBuffer = Buffer.from(int32Array.buffer);

    const version = new Date().toISOString().replace(/[-:.]/g, '');

    // Metadata JSON
    const indexData: HistoryIndex = {
        version,
        dates,
        offsets
    };
    const indexJsonStr = JSON.stringify(indexData);
    
    // Compress both
    const compressedBinary = zlib.brotliCompressSync(binaryBuffer);
    const compressedIndex = zlib.brotliCompressSync(Buffer.from(indexJsonStr, 'utf-8'));

    const dataCheckSum = crypto.createHash('sha256').update(binaryBuffer).digest('hex');
    const indexCheckSum = crypto.createHash('sha256').update(indexJsonStr).digest('hex');

    const dataFileName = `history-data.v${version}.bin.br`;
    const indexFileName = `history-index.v${version}.json.br`;

    console.log(` -> Binary uncompressed size: ${(binaryBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(` -> Binary Brotli compressed size: ${(compressedBinary.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(` -> Index JSON uncompressed size: ${(Buffer.from(indexJsonStr).length / 1024 / 1024).toFixed(2)} MB`);
    console.log(` -> Index JSON Brotli compressed size: ${(compressedIndex.length / 1024 / 1024).toFixed(2)} MB`);

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

    // Pointer file
    const pointerFile: HistoryPointerFile = {
        version,
        indexUrl: `${R2_PUBLIC_URL}/history/${indexFileName}`,
        dataUrl: `${R2_PUBLIC_URL}/history/${dataFileName}`,
        indexCheckSum,
        dataCheckSum,
        cardCount,
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

    console.log(' -> ✅ All history artifacts uploaded successfully');
}

async function main() {
    try {
        await generateHistoryIndex();
        console.log('\n-- ✅ Offline History Index build complete! --');
    } catch (error) {
        console.error('\n❌ An error occurred during the build process:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}
main();
