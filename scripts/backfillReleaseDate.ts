import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BATCH_SIZE = 500;

async function backfillReleaseDate() {
    console.log('Starting backfill for card release dates...');

    const totalCardsToUpdate = await prisma.card.count({
        where: {
            releaseDate: null
        }
    });

    if (totalCardsToUpdate === 0) {
        console.log('✅ No cards to update. All records have a release date.');
        return;
    }

    console.log(
        `Found ${totalCardsToUpdate} cards to update. Processing in batches of ${BATCH_SIZE}...`
    );

    let updatedCount = 0;
    while (updatedCount < totalCardsToUpdate) {
        const cardsToUpdate = await prisma.card.findMany({
            where: {
                releaseDate: null
            },
            take: BATCH_SIZE,
            include: {
                set: {
                    select: {
                        releaseDate: true
                    }
                }
            }
        });

        if (cardsToUpdate.length === 0) {
            break;
        }

        console.log(`- Processing a batch of ${cardsToUpdate.length} cards...`);

        const updatePromises = cardsToUpdate.map((card) => {
            return prisma.card.update({
                where: { id: card.id },
                data: { releaseDate: card.set.releaseDate }
            });
        });

        await Promise.all(updatePromises);

        updatedCount += cardsToUpdate.length;
        console.log(`- Batch complete. Total updated: ${updatedCount}/${totalCardsToUpdate}`);
    }

    console.log('✅ Backfill for release dates complete!');
}

backfillReleaseDate()
    .catch((e) => {
        console.error('❌ An error occurred during the backfill:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
