import { PrismaClient } from '@prisma/client';
import { performance } from 'perf_hooks';
import pLimit from 'p-limit';
import { optimizeImage } from './optimizeImages';

const prisma = new PrismaClient();
const ALL_SIZES = [64, 384, 512, 640];
const limit = pLimit(4);

// --- CLI args ---
// Usage: npx tsx optimizeImages.targeted.ts --setIds=me1,me2 [--force]
const args = process.argv.slice(2);

const setIdsArg = args.find((a) => a.startsWith('--setIds='));
const TARGET_SET_IDS: string[] = setIdsArg
    ? setIdsArg.replace('--setIds=', '').split(',').map((s) => s.trim())
    : [];
const FORCE = args.includes('--force');

if (TARGET_SET_IDS.length === 0) {
    console.error('❌ No set IDs provided. Usage: --setIds=me1,me2 [--force]');
    process.exit(1);
}

async function main() {
    const mainStartTime = performance.now();
    console.log(`🚀 Starting targeted optimization for sets: ${TARGET_SET_IDS.join(', ')}`);
    console.log(`Force re-optimize: ${FORCE}\n`);

    const cardImages = await prisma.card.findMany({
        where: {
            imageKey: { not: null },
            setId: { in: TARGET_SET_IDS },
            ...(FORCE ? {} : { imagesOptimized: false })
        },
        select: { id: true, imageKey: true }
    });

    console.log(`Found ${cardImages.length} card images to process.\n`);

    if (cardImages.length === 0) {
        console.log('🎉 No images to process. Try --force to reprocess already-optimized images.');
        await prisma.$disconnect();
        return;
    }

    // Reset the flag upfront when forcing, so partial failures don't leave stale true values
    if (FORCE) {
        await prisma.card.updateMany({
            where: { id: { in: cardImages.map((c) => c.id) } },
            data: { imagesOptimized: false }
        });
        console.log(`🔄 Reset imagesOptimized flag for ${cardImages.length} cards.\n`);
    }

    let processed = 0;

    const tasks = cardImages.map((img) =>
        limit(async () => {
            const startTime = performance.now();
            try {
                await optimizeImage({ id: img.id, r2Key: img.imageKey!, type: 'card' });
                await prisma.card.update({
                    where: { id: img.id },
                    data: { imagesOptimized: true }
                });
                processed++;
                const timeTaken = ((performance.now() - startTime) / 1000).toFixed(2);
                console.log(`✅ ${img.imageKey} in ${timeTaken}s — ${processed}/${cardImages.length}`);
            } catch (error) {
                console.error(`❌ FAILED: ${img.imageKey}`, (error as Error).message);
            }
        })
    );

    await Promise.all(tasks);

    const totalTime = ((performance.now() - mainStartTime) / 1000 / 60).toFixed(2);
    console.log(`\n🎉 Done in ${totalTime} minutes!`);
    console.log(`📈 Total variants created: ${processed * ALL_SIZES.length}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });