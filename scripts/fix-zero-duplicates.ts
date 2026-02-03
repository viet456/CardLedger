import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function chunkArray<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

async function main() {
    console.log('🔍 Finding Zero-Notation Duplicates...');

    const allCards = await prisma.card.findMany({
        select: { id: true, setId: true }
    });

    // Group cards by a "Normalized ID" scoped to their specific set
    const groups = new Map<string, string[]>();

    for (const card of allCards) {
        const parts = card.id.split('-');
        if (parts.length < 2) continue;

        const setId = card.setId;
        const numPart = parts[parts.length - 1].replace(/^0+/, '');

        // normalizedId: "sv03.5-86" (removes leading zeros but keeps set prefix)
        const normalizedId = `${setId}-${numPart}`;

        const existing = groups.get(normalizedId) || [];
        existing.push(card.id);
        groups.set(normalizedId, existing);
    }

    // Filter only for the actual collisions
    const collisionGroups = Array.from(groups.values()).filter((ids) => ids.length > 1);

    console.log(`🚀 Found ${collisionGroups.length} collisions. Merging in parallel chunks...`);

    const chunks = chunkArray(collisionGroups, 10);

    for (const chunk of chunks) {
        await Promise.all(
            chunk.map(async (ids) => {
                // TCGDex logic: the 'target' is the ID with the leading zero (e.g., -086)
                const targetId = ids.find((id) => id.includes('-0')) || ids[0];
                const duplicateId = ids.find((id) => id !== targetId)!;

                try {
                    await prisma.$transaction(
                        async (tx) => {
                            // Safety check: ensure both cards still exist and belong to the same set
                            const [cardA, cardB] = await Promise.all([
                                tx.card.findUnique({ where: { id: targetId } }),
                                tx.card.findUnique({ where: { id: duplicateId } })
                            ]);

                            if (!cardA || !cardB || cardA.setId !== cardB.setId) return;

                            // Clear out relations for the 'target' card to avoid P2003 errors
                            // This metadata will be re-populated by populate.ts later.
                            await tx.attackCost.deleteMany({
                                where: { attack: { cardId: targetId } }
                            });
                            await tx.attack.deleteMany({ where: { cardId: targetId } });
                            await tx.ability.deleteMany({ where: { cardId: targetId } });
                            await tx.subtypesOnCards.deleteMany({ where: { cardId: targetId } });
                            await tx.typesOnCards.deleteMany({ where: { cardId: targetId } });

                            await tx.card.delete({ where: { id: targetId } });

                            await tx.card.update({
                                where: { id: duplicateId },
                                data: { id: targetId }
                            });
                        },
                        { timeout: 30000 }
                    );
                    process.stdout.write('.');
                } catch (e: any) {
                    console.error(`\n❌ Error merging ${duplicateId}:`, e.message);
                }
            })
        );
    }

    console.log('\n✅ Merge surgery complete.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
