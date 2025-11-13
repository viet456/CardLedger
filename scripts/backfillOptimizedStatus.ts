import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const COMPLETED_IMAGES_FILE = path.join(__dirname, '_completed_images.txt');

async function main() {
    console.log('Starting backfill...');

    let completedKeys: Set<string>;
    try {
        if (fs.existsSync(COMPLETED_IMAGES_FILE)) {
            const fileContent = fs.readFileSync(COMPLETED_IMAGES_FILE, 'utf-8');
            completedKeys = new Set(fileContent.split('\n').filter((id) => id.trim() !== ''));
            console.log(`Loaded ${completedKeys.size} completed image R2 keys.`);
        } else {
            console.log(`Error: '${COMPLETED_IMAGES_FILE}' not found. No keys to backfill.`);
            return;
        }
    } catch (error) {
        console.error(`Error reading completed images file: `, error);
        process.exit(1);
    }

    const cardKeys: string[] = [];
    const logoKeys: string[] = [];
    const symbolKeys: string[] = [];

    for (const key of completedKeys) {
        if (key.startsWith('cards/')) {
            cardKeys.push(key);
        } else if (key.startsWith('sets/') && key.endsWith('-logo.png')) {
            logoKeys.push(key);
        } else if (key.startsWith('sets/') && key.endsWith('-symbol.png')) {
            symbolKeys.push(key);
        }
    }

    // 3. Update the database in bulk
    console.log(`Updating ${cardKeys.length} card image statuses...`);
    const cardUpdateResult = await prisma.card.updateMany({
        where: { imageKey: { in: cardKeys } },
        data: { imagesOptimized: true }
    });
    console.log(`Updated ${cardUpdateResult.count} card records.`);

    console.log(`Updating ${logoKeys.length} set logo statuses...`);
    const logoUpdateResult = await prisma.set.updateMany({
        where: { logoImageKey: { in: logoKeys } },
        data: { logoOptimized: true }
    });
    console.log(`Updated ${logoUpdateResult.count} set logo records.`);

    console.log(`Updating ${symbolKeys.length} set symbol statuses...`);
    const symbolUpdateResult = await prisma.set.updateMany({
        where: { symbolImageKey: { in: symbolKeys } },
        data: { symbolOptimized: true }
    });
    console.log(`Updated ${symbolUpdateResult.count} set symbol records.`);

    console.log('✅ Backfill complete!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
