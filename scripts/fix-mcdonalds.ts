import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("🍔 Fixing McDonald's Duplicate Sets...");

    const badSets = await prisma.set.findMany({
        where: { name: { contains: "Macdonald's" } }
    });

    for (const badSet of badSets) {
        // Find the year (e.g., "2021") to match the "Good" set
        const yearMatch = badSet.name.match(/\d{4}/);
        if (!yearMatch) continue;
        const year = yearMatch[0];

        const goodSet = await prisma.set.findFirst({
            where: {
                name: { contains: `McDonald's Collection ${year}` },
                id: { not: badSet.id }
            }
        });

        if (goodSet) {
            console.log(`\nMerging ${year}:`);
            console.log(`   🗑️  Deleting Bad Set: ${badSet.name} (${badSet.id})`);
            console.log(
                `   ✨  Updating Good Set: ${goodSet.name} (${goodSet.id}) -> (${badSet.id})`
            );

            try {
                await prisma.$transaction(async (tx) => {
                    // 1. CLEANUP RELATIONS (The "Bad" cards need to be fully stripped)
                    // We must delete the deepest children (AttackCost) first

                    await tx.attackCost.deleteMany({
                        where: { attack: { card: { setId: badSet.id } } }
                    });

                    await tx.attack.deleteMany({
                        where: { card: { setId: badSet.id } }
                    });

                    await tx.ability.deleteMany({
                        where: { card: { setId: badSet.id } }
                    });

                    await tx.subtypesOnCards.deleteMany({
                        where: { card: { setId: badSet.id } }
                    });

                    await tx.typesOnCards.deleteMany({
                        where: { card: { setId: badSet.id } }
                    });

                    // 2. NOW it is safe to delete the Cards
                    await tx.card.deleteMany({ where: { setId: badSet.id } });

                    // 3. Delete the Set Shell
                    await tx.set.delete({ where: { id: badSet.id } });

                    // 4. Move the Good Set to the Bad Set's ID
                    await tx.set.update({
                        where: { id: goodSet.id },
                        data: {
                            id: badSet.id, // Adopt the ID TCGDex expects
                            tcgdexId: badSet.id, // Link for the SDK
                            seriesId: badSet.seriesId // Move to the correct Series group
                        }
                    });
                });
                console.log(`   ✅  Success! Images preserved, ID updated.`);
            } catch (e: any) {
                console.error(`   ❌ Failed to merge ${badSet.name}:`, e.message);
            }
        } else {
            console.log(`   ⚠️  Could not find a matching 'McDonald's' set for ${badSet.name}`);
        }
    }
}

main()
    .catch((e) => console.error(e))
    .finally(() => prisma.$disconnect());
