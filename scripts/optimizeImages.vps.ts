import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import pLimit from 'p-limit';

// VPS VERSION - uses parallel uploads and higher concurrency
// DO NOT run on local machine

const prisma = new PrismaClient();
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

const DEVICE_SIZES = [640, 750, 828, 1080];
const IMAGE_SIZES = [16, 32, 48, 64, 96];
const CARD_SIZES = [192, 384];
const ALL_SIZES = [...IMAGE_SIZES, ...CARD_SIZES, ...DEVICE_SIZES];
const QUALITY = 75;
const limit = pLimit(8);
const COMPLETED_IMAGES_FILE = path.join(__dirname, '_completed_images.txt');

interface ImageToOptimize {
    id: string;
    r2Key: string; // eg 'cards/me1-1.png'
}

// async function checkIfExists(key: string): Promise<boolean> {
//     try {
//         await r2.send(new HeadObjectCommand({
//             Bucket: R2_BUCKET_NAME,
//             Key: key
//         }));
//         return true;
//     } catch (error) {
//         return false;
//     }
// }

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
        //console.log(` ⏳ [${image.r2Key}] Resizing ${ALL_SIZES.length} variants...`);

        // Run resizes in parallel
        const variantPromises = ALL_SIZES.map(async (width) => {
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
        //console.log(` ✅ [${image.r2Key}] Resizing complete.`);

        //console.log(` ☁️ [${image.r2Key}] Uploading ${variants.length} variants...`);

        // **ON VPS**: simultaneous uploading of images to r2
        await Promise.all(
            variants.map((variant) =>
                uploadImageToR2(variant.optimizedKey, variant.optimizedBuffer, 'image/avif')
            )
        );
        //console.log(` ✅ Completed ${image.r2Key} (${variants.length} new variants)...`);
    } catch (error) {
        console.error(`❌ Error processing ${image.r2Key}:`, error);
        throw error;
    }
}

async function main() {
    const mainStartTime = performance.now();
    const lastCompletionTime = performance.now();
    console.log(' 🚀 Starting image optimization...\n');
    console.log(`Sizes: ${ALL_SIZES.join(', ')}`);
    console.log(`Quality: ${QUALITY}`);
    console.log(`Format: AVIF\n`);

    let completedImageIds = new Set<string>();
    try {
        if (fs.existsSync(COMPLETED_IMAGES_FILE)) {
            const fileContent = fs.readFileSync(COMPLETED_IMAGES_FILE, 'utf-8');
            completedImageIds = new Set(fileContent.split('\n').filter((id) => id.trim() !== ''));
            console.log(`Loaded ${completedImageIds.size} completed image IDs from file.`);
        } else {
            console.log(`'${COMPLETED_IMAGES_FILE}' not found, creating it.`);
            fs.writeFileSync(COMPLETED_IMAGES_FILE, '');
        }
    } catch (error) {
        console.error(`Error reading or creating completed images file: `, error);
        process.exit(1);
    }
    const cardImages = await prisma.card.findMany({
        where: {
            imageKey: {
                not: null
            }
        },
        select: {
            id: true,
            imageKey: true
        }
    });
    const setImages = await prisma.set.findMany({
        where: {
            OR: [
                {
                    logoImageKey: { not: null }
                },
                {
                    symbolImageKey: { not: null }
                }
            ]
        },
        select: {
            id: true,
            logoImageKey: true,
            symbolImageKey: true
        }
    });
    console.log(`Found ${cardImages.length} card images to process.`);
    console.log(`Found ${setImages.length} sets with images to process.\n`);

    const cardImagesToOptimize: ImageToOptimize[] = cardImages.map((img) => ({
        id: img.id,
        r2Key: img.imageKey!
    }));
    const setImagesToOptimize: ImageToOptimize[] = setImages.flatMap((set) => {
        const images: ImageToOptimize[] = [];
        if (set.logoImageKey) {
            images.push({ id: `${set.id}-logo`, r2Key: set.logoImageKey });
        }
        if (set.symbolImageKey) {
            images.push({ id: `${set.id}-symbol`, r2Key: set.symbolImageKey });
        }
        return images;
    });

    const allImagesToOptimize = [...cardImagesToOptimize, ...setImagesToOptimize];
    const imagesToProcess = allImagesToOptimize.filter((img) => !completedImageIds.has(img.r2Key));
    let processed = 0;

    const tasks = imagesToProcess.map((image) => {
        return limit(async () => {
            // console.log(`--- Processing ${image.r2Key} ---`);
            const startTime = performance.now();
            try {
                await optimizeImage(image);
                const now = performance.now();
                const timeTaken = ((now - startTime) / 1000).toFixed(2);
                fs.appendFileSync(COMPLETED_IMAGES_FILE, `${image.r2Key}\n`);
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
