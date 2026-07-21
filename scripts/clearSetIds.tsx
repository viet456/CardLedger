import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../prisma/generated/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

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
