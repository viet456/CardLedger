import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';
import TCGdex from '@tcgdex/sdk';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const tcgdex = new TCGdex('en');

// Sets that were previously blocked from the populate script
const BLOCKED_SETS = ['mee', 'mfb', '2024sv', '2023sv', '2022swsh', 'jumbo'];

async function backfillSetReleaseDates() {
    console.log('🔄 Backfilling set release dates from TCGdex API...');

    const sets = await prisma.set.findMany({
        where: {
            id: { notIn: BLOCKED_SETS },
        },
        select: {
            id: true,
            name: true,
            tcgdexId: true,
            releaseDate: true,
        },
    });

    console.log(`Found ${sets.length} sets to check.\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const set of sets) {
        try {
            const fullSet = await tcgdex.fetch('sets', set.tcgdexId ?? set.id);
            if (!fullSet?.releaseDate) {
                console.log(`  ⚠️  ${set.name} (${set.id}): No releaseDate from API, skipping.`);
                skippedCount++;
                continue;
            }

            const apiDate = new Date(fullSet.releaseDate);
            const dbDate = new Date(set.releaseDate);

            // Compare dates (ignore time component)
            const apiDateStr = apiDate.toISOString().split('T')[0];
            const dbDateStr = dbDate.toISOString().split('T')[0];

            if (apiDateStr === dbDateStr) {
                skippedCount++;
                continue;
            }

            // Update the set's releaseDate
            await prisma.set.update({
                where: { id: set.id },
                data: { releaseDate: apiDate },
            });

            // Also update all cards in this set to match
            const cardsUpdated = await prisma.card.updateMany({
                where: { setId: set.id },
                data: { releaseDate: apiDate },
            });

            console.log(
                `  ✅ ${set.name} (${set.id}): ${dbDateStr} → ${apiDateStr} (${cardsUpdated.count} cards updated)`
            );
            updatedCount++;
        } catch (e) {
            console.error(`  ❌ Error on ${set.name} (${set.id}):`, (e as Error).message);
            errorCount++;
        }
    }

    console.log(`\n✨ Backfill complete.`);
    console.log(`   Updated: ${updatedCount}`);
    console.log(`   Skipped (already correct or no API data): ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);
}

backfillSetReleaseDates()
    .catch((e) => {
        console.error('❌ An error occurred during the backfill:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });