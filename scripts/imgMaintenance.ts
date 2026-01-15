import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { GetObjectCommand, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';
import pLimit from 'p-limit';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const COMPLETED_FILE = path.join(__dirname, '_maintenance_completed.txt');

const PATCH_SIZE = 512;
const SIZES_TO_PRUNE = [16, 32, 48, 96, 192, 750, 828, 1080];
const QUALITY = 75;

const limit = pLimit(5);

async function runMaintenance(image: { r2Key: string }) {
    const pathWithoutExt = image.r2Key.replace(/\.[^/.]+$/, '');

    try {
        const response = await r2.send(
            new GetObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: image.r2Key
            })
        );
        const byteArray = await response.Body!.transformToByteArray();
        const buffer = Buffer.from(byteArray);
        const metadata = await sharp(buffer).metadata();

        if (metadata.width && metadata.width >= PATCH_SIZE) {
            const patchedBuffer = await sharp(buffer)
                .resize(PATCH_SIZE, null, { withoutEnlargement: true, fit: 'inside' })
                .avif({ quality: QUALITY, effort: 9 })
                .toBuffer();

            await r2.send(
                new PutObjectCommand({
                    Bucket: R2_BUCKET_NAME,
                    Key: `optimized/${pathWithoutExt}/${PATCH_SIZE}.avif`,
                    Body: patchedBuffer,
                    ContentType: 'image/avif',
                    CacheControl: 'public, max-age=31536000, immutable'
                })
            );
        }

        const Objects = SIZES_TO_PRUNE.map((size) => ({
            Key: `optimized/${pathWithoutExt}/${size}.avif`
        }));

        await r2.send(
            new DeleteObjectsCommand({
                Bucket: R2_BUCKET_NAME,
                Delete: { Objects }
            })
        );

        fs.appendFileSync(COMPLETED_FILE, `${image.r2Key}\n`);
        console.log(` ✅ Done: ${image.r2Key}`);
    } catch (error) {
        console.error(` ❌ Error: ${image.r2Key}`, (error as Error).message);
    }
}

async function main() {
    let completedKeys = new Set<string>();
    if (fs.existsSync(COMPLETED_FILE)) {
        const content = fs.readFileSync(COMPLETED_FILE, 'utf-8');
        completedKeys = new Set(content.split('\n').filter(Boolean));
    }

    const allImages = await prisma.card.findMany({
        where: { imagesOptimized: true },
        select: { imageKey: true }
    });
    const imagesToProcess = allImages.filter((img) => !completedKeys.has(img.imageKey!));

    console.log(
        `🚀 Processing ${imagesToProcess.length} images (${completedKeys.size} already skipped)...`
    );

    const tasks = imagesToProcess.map((img) =>
        limit(() => runMaintenance({ r2Key: img.imageKey! }))
    );
    await Promise.all(tasks);

    console.log('\n🎉 R2 Bucket is now lean and optimized!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
