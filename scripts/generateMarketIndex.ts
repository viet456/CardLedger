import { PrismaClient } from '@prisma/client';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';
import crypto from 'crypto';
import { stat } from 'fs';

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
const prisma = new PrismaClient();
const BUCKET_NAME = 'cardledger';

async function getDailyPrices() {
    console.log('Starting to build the market price index artifact...');
    console.log(' -> Querying all daily-prices from the database...');
    const allDailyPrices = await prisma.marketStats.findMany({
        select: {
            cardId: true,
            tcgNearMintLatest: true
        }
    });
    console.log(`Processing ${allDailyPrices.length} card prices.`);

    const priceMap: Record<string, number> = allDailyPrices.reduce(
        (acc, stat) => {
            if (stat.tcgNearMintLatest !== null) {
                acc[stat.cardId] = stat.tcgNearMintLatest.toNumber();
            }
            return acc;
        },
        {} as Record<string, number>
    );
    return priceMap;
}

async function generateMarketIndex() {
    const dailyPrices = await getDailyPrices();
    const version = new Date().toISOString().replace(/[-:.]/g, '');
    const finalJsonObject = {
        version: version,
        prices: dailyPrices
    };
    const jsonData = JSON.stringify(finalJsonObject);
    const checkSum = crypto.createHash('sha256').update(jsonData).digest('hex');
    const artifactFileName = `market-index.v${version}.json`;
    console.log(` -> Final JSON size: ${(jsonData.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(` -> Generated version: ${version}, checksum: ${checkSum.substring(0, 12)}...`);

    console.log(` -> Uploading main artifact to R2: ${artifactFileName}`);
    const putArtifactCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `market/${artifactFileName}`,
        Body: jsonData,
        ContentType: 'applications/json',
        CacheControl: 'public, max-age=172800, immutable' // 2 days
    });
    await r2.send(putArtifactCommand);
    console.log(' -> ✅ Main artifact uploaded successfully');

    const pointerFile = {
        version: version,
        url: `${R2_PUBLIC_URL}/market/${artifactFileName}`,
        checkSum: checkSum,
        cardCount: dailyPrices.length,
        updatedAt: new Date().toISOString
    };
    const pointerFileName = 'market-index.current.json';
    console.log(`-> Uploading pointer file to R2: ${pointerFileName}`);
    const putPointerCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `market/${pointerFileName}`,
        Body: JSON.stringify(pointerFile),
        ContentType: 'applications/json',
        CacheControl: 'public, max-age=300' // cache for 5 minutes
    });
    await r2.send(putPointerCommand);
    console.log(' -> ✅ Pointer file uploaded successfully');
}

async function main() {
    try {
        await generateMarketIndex();
        console.log('\n-- ✅ Market index build complete! --');
    } catch (error) {
        console.error('\n❌ An error occurred during the build process:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}
main();
