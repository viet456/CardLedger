import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const POKEPRICETRACKER_KEY = process.env.POKEPRICETRACKER_KEY;
const PRICING_API_SETS_URL = 'https://www.pokemonpricetracker.com/api/v2/sets';

interface ApiSet {
    id: string;
    tcgPlayerId: string;
    tcgPlayerNumericId: number;
    name: string;
}

async function fetchAllApiSets(): Promise<Map<string, number>> {
    console.log('📡 Fetching ALL sets from API...');
    const response = await axios.get(PRICING_API_SETS_URL, {
        headers: { Authorization: `Bearer ${POKEPRICETRACKER_KEY}` },
        params: { limit: 2000 }
    });

    const apiSets = response.data.data as ApiSet[];
    console.log(`   -> Received ${apiSets.length} sets from API.`);

    const lookupMap = new Map<string, number>();

    for (const set of apiSets) {
        if (set.tcgPlayerId && set.tcgPlayerNumericId) {
            lookupMap.set(set.tcgPlayerId, set.tcgPlayerNumericId);
        }
    }

    return lookupMap;
}

async function main() {
    const apiIdMap = await fetchAllApiSets();

    const setsToMigrate = await prisma.set.findMany({
        where: {
            tcgPlayerSetId: { not: null },
            tcgPlayerNumericId: null
        },
        select: { id: true, name: true, tcgPlayerSetId: true }
    });

    console.log(`\n📋 Found ${setsToMigrate.length} local sets pending migration.`);

    let successCount = 0;
    let missingCount = 0;

    console.log('🚀 Starting Batch Update...');

    let duplicateCount = 0;
    for (const localSet of setsToMigrate) {
        if (!localSet.tcgPlayerSetId) continue;

        const numericId = apiIdMap.get(localSet.tcgPlayerSetId);

        if (numericId) {
            try {
                await prisma.set.update({
                    where: { id: localSet.id },
                    data: { tcgPlayerNumericId: numericId }
                });
                process.stdout.write('.');
                successCount++;
            } catch (error: any) {
                // Prisma duplicate on unique column
                if (error.code === 'P2002') {
                    console.log(`\n   ❌ Duplicate Collision: Cannot update "${localSet.name}". The numeric ID ${numericId} is already taken by another set in the DB.`);
                    duplicateCount++;
                } else {
                    // Rethrow if it's a completely different database error
                    throw error;
                }
            }
        } else {
            console.log(`\n   ⚠️  No match for: ${localSet.name} (ID: ${localSet.tcgPlayerSetId})`);
            missingCount++;
        }
    }

    console.log('\n\n--- Migration Complete ---');
    console.log(`✅ Updated: ${successCount}`);
    console.log(`❌ No Match Found: ${missingCount}`);
    console.log(`❌ Duplicate Count: ${duplicateCount}`);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
