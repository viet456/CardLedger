import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';
import { performance } from 'perf_hooks';
import pLimit from 'p-limit';

const prisma = new PrismaClient();
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

const ALL_SIZES = [64, 384, 512, 640]; // 640 is near the original PNG size
const QUALITY = 75;
const limit = pLimit(4);

interface ImageToOptimize {
    id: string;
    r2Key: string; // eg 'cards/me1-1.png'
    type: 'card' | 'setLogo' | 'setSymbol';
}

async function downloadFromR2(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key
    });
    const response = await r2.send(command);
    if (!response.Body) {
        throw new Error(`No body in response for ${key}`);
    }
    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
}

async function uploadImageToR2(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await r2.send(
        new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            CacheControl: 'public, max-age=31536000, immutable'
        })
    );
}

async function optimizeImage(image: ImageToOptimize): Promise<void> {
    try {
        const originalBuffer = await downloadFromR2(image.r2Key);

        // Only process sizes <= sourceWidth
        // const metadata = await sharp(originalBuffer).metadata();
        // const sourceWidth = metadata.width || 0;
        // let validSizes = ALL_SIZES.filter((size) => size <= sourceWidth);
        // if (validSizes.length === 0) {
        //     validSizes = [ALL_SIZES[0]];
        // }
        const validSizes = ALL_SIZES;

        // Run resizes in parallel
        const variantPromises = validSizes.map(async (width) => {
            const pathWithoutExtension = image.r2Key.replace(/\.[^/.]+$/, '');
            const optimizedKey = `optimized/${pathWithoutExtension}/${width}.avif`;
            const optimizedBuffer = await sharp(originalBuffer)
                .resize(width, null, {
                    withoutEnlargement: true,
                    fit: 'inside'
                })
                .avif({
                    quality: QUALITY,
                    effort: 6
                })
                .toBuffer();
            return { optimizedKey, optimizedBuffer, width };
        });
        const variants = await Promise.all(variantPromises);
        for (const variant of variants) {
            await uploadImageToR2(variant.optimizedKey, variant.optimizedBuffer, 'image/avif');
        }
    } catch (error) {
        console.error(`❌ Error processing ${image.r2Key}:`, error);
        throw error;
    }
}

async function main() {
    const mainStartTime = performance.now();
    console.log(' 🚀 Starting image optimization...\n');
    console.log(`Sizes: ${ALL_SIZES.join(', ')}`);
    console.log(`Quality: ${QUALITY}`);
    console.log(`Format: AVIF\n`);

    const cardImages = await prisma.card.findMany({
        where: {
            imageKey: {
                not: null
            },
            imagesOptimized: false
        },
        select: {
            id: true,
            imageKey: true
        }
    });
    const setLogos = await prisma.set.findMany({
        where: {
            logoImageKey: { not: null },
            logoOptimized: false
        },
        select: {
            id: true,
            logoImageKey: true
        }
    });
    const setSymbols = await prisma.set.findMany({
        where: {
            symbolImageKey: { not: null },
            symbolOptimized: false
        },
        select: {
            id: true,
            symbolImageKey: true
        }
    });
    console.log(`Found ${cardImages.length} card images to process.`);
    console.log(`Found ${setLogos.length} set logos to process.`);
    console.log(`Found ${setSymbols.length} set symbols to process.\n`);

    const cardImagesToOptimize: ImageToOptimize[] = cardImages.map((img) => ({
        id: img.id,
        r2Key: img.imageKey!,
        type: 'card'
    }));
    const setImagesToOptimize: ImageToOptimize[] = [
        ...setLogos.map((set) => ({
            id: set.id,
            r2Key: set.logoImageKey!,
            type: 'setLogo' as const
        })),
        ...setSymbols.map((set) => ({
            id: set.id,
            r2Key: set.symbolImageKey!,
            type: 'setSymbol' as const
        }))
    ];

    const imagesToProcess = [...cardImagesToOptimize, ...setImagesToOptimize];
    if (imagesToProcess.length === 0) {
        console.log('🎉  No images to process. Everything is up to date!');
        await prisma.$disconnect();
        return;
    }
    console.log(`Total images to process: ${imagesToProcess.length}`);
    let processed = 0;

    const tasks = imagesToProcess.map((image) => {
        return limit(async () => {
            // console.log(`--- Processing ${image.r2Key} ---`);
            const startTime = performance.now();
            try {
                await optimizeImage(image);
                switch (image.type) {
                    case 'card':
                        await prisma.card.update({
                            where: { id: image.id },
                            data: { imagesOptimized: true }
                        });
                        break;
                    case 'setLogo':
                        await prisma.set.update({
                            where: { id: image.id },
                            data: { logoOptimized: true }
                        });
                        break;
                    case 'setSymbol':
                        await prisma.set.update({
                            where: { id: image.id },
                            data: { symbolOptimized: true }
                        });
                        break;
                }
                const now = performance.now();
                const timeTaken = ((now - startTime) / 1000).toFixed(2);
                processed++;

                console.log(` ✅ Completed ${image.r2Key} in ${timeTaken}s`);
                console.log(
                    ` 📊 Progress: ${processed}/${imagesToProcess.length} images to complete`
                );
            } catch (error) {
                console.error(
                    `- ❌ FAILED TASK: ${image.r2Key}. Will retry on next run.`,
                    (error as Error).message
                );
            }
        });
    });
    await Promise.all(tasks);

    const mainEndTime = performance.now();
    const totalTimeTaken = ((mainEndTime - mainStartTime) / 1000 / 60).toFixed(2); // In minutes
    console.log(` 🎉 All images optimized in ${totalTimeTaken} minutes!`);
    const totalVariants = imagesToProcess.length * ALL_SIZES.length;
    console.log(`\n 📈 Total variants created: ${totalVariants}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
