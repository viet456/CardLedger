import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearSetIds() {
    console.log('🗑️  Clearing all tcgPlayerSetId values...');

    const result = await prisma.set.updateMany({
        where: {},
        data: {
            tcgPlayerSetId: null
        }
    });

    console.log(`✅ Cleared IDs for ${result.count} sets.`);
}

clearSetIds()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
