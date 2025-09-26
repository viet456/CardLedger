import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BATCH_SIZE = 500;

async function backfillPokedexSort() {
    console.log('Starting backfill for pokedexNumberSort...');
    const totalCardsToUpdate = await prisma.card.count({
        where: {
            pokedexNumberSort: null,
            nationalPokedexNumbers: {
                isEmpty: false
            }
        }
    });
    if (totalCardsToUpdate === 0) {
        console.log('✅ No cards to update. All records are already up to date.');
        return;
    }
    console.log(
        `Found ${totalCardsToUpdate} cards to update. Processing in batches of ${BATCH_SIZE}...`
    );

    let updatedCount = 0;
    while (updatedCount < totalCardsToUpdate) {
        // Find the next batch of cards to update
        const cardsToUpdate = await prisma.card.findMany({
            where: {
                pokedexNumberSort: null,
                nationalPokedexNumbers: {
                    isEmpty: false
                }
            },
            take: BATCH_SIZE,
            select: {
                id: true,
                nationalPokedexNumbers: true
            }
        });

        if (cardsToUpdate.length === 0) {
            break;
        }

        console.log(`- Processing a batch of ${cardsToUpdate.length} cards...`);

        const updatePromises = cardsToUpdate.map((card) => {
            const firstPokedexNumber = card.nationalPokedexNumbers[0];
            return prisma.card.update({
                where: { id: card.id },
                data: { pokedexNumberSort: firstPokedexNumber }
            });
        });

        await Promise.all(updatePromises);

        updatedCount += cardsToUpdate.length;
        console.log(`- Batch complete. Total updated: ${updatedCount}/${totalCardsToUpdate}`);
    }
    console.log('✅ Backfill complete!');
}

backfillPokedexSort()
    .catch((e) => {
        console.error('❌ An error occurred during the backfill:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
