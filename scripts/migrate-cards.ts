import { PrismaClient } from '@prisma/client';
import TCGdex from '@tcgdex/sdk';
import {
    CopyObjectCommand,
    ListObjectsV2Command,
    HeadObjectCommand,
    ListObjectsV2CommandOutput
} from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';
const prisma = new PrismaClient();
const tcgdex = new TCGdex('en');
const BUCKET_NAME = process.env.R2_BUCKET_NAME!;

function sanitizePublicId(id: string): string {
    const characterMap: { [key: string]: string } = { '?': 'question', '!': 'exclamation' };
    const regex = new RegExp(
        Object.keys(characterMap)
            .map((c) => `\\${c}`)
            .join('|'),
        'g'
    );
    return id.replace(regex, (match) => `_${characterMap[match]}`);
}

// --- Helper: R2 Operations ---

async function safeCopyS3Object(oldKey: string, newKey: string): Promise<boolean> {
    try {
        // Check if source exists
        try {
            await r2.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: oldKey }));
        } catch (e: any) {
            if (e.name === 'NotFound') return true; // Skip if source doesn't exist (not a failure)
            throw e;
        }

        // Check if destination already exists (Idempotency)
        try {
            await r2.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: newKey }));
            // If it exists, assume it was already copied successfully.
            return true;
        } catch (e: any) {
            // Destination doesn't exist, proceed to copy
        }

        // Copy
        await r2.send(
            new CopyObjectCommand({
                Bucket: BUCKET_NAME,
                CopySource: `${BUCKET_NAME}/${oldKey}`,
                Key: newKey,
                ACL: 'public-read',
                ContentType: getContentType(newKey)
            })
        );

        return true;
    } catch (e) {
        console.error(`    ❌ Failed to copy S3 object: ${oldKey} -> ${newKey}`, e);
        return false;
    }
}

async function safeCopyS3Folder(oldPrefix: string, newPrefix: string): Promise<boolean> {
    let continuationToken: string | undefined = undefined;
    let allSuccess = true;

    do {
        const listCmd = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: oldPrefix,
            ContinuationToken: continuationToken
        });

        const res = (await r2.send(listCmd)) as ListObjectsV2CommandOutput;

        if (res.Contents) {
            for (const obj of res.Contents) {
                if (!obj.Key) continue;
                // Replace the prefix in the key to maintain the folder structure
                const newKey = obj.Key.replace(oldPrefix, newPrefix);
                const success = await safeCopyS3Object(obj.Key, newKey);
                if (!success) allSuccess = false;
            }
        }
        continuationToken = res.NextContinuationToken;
    } while (continuationToken);

    return allSuccess;
}

function getContentType(key: string) {
    if (key.endsWith('.png')) return 'image/png';
    if (key.endsWith('.avif')) return 'image/avif';
    return 'application/octet-stream';
}

// --- Main Migration Logic ---

async function main() {
    console.log('🛡️ Starting SAFE Migration (Copy Only)...');

    const apiSets = await tcgdex.fetch('sets');
    const dbSets = await prisma.set.findMany();

    for (const dbSet of dbSets) {
        // Find the TCGDex Match
        const normalizedDbName = dbSet.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const match = apiSets?.find(
            (s) => s.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedDbName
        );

        if (!match) continue; // Skip sets we can't match safely

        const targetId = match.id;

        // Skip if IDs already match (just ensure tcgdexId is linked)
        if (dbSet.id === targetId) {
            if (dbSet.tcgdexId !== targetId) {
                await prisma.set.update({
                    where: { id: dbSet.id },
                    data: { tcgdexId: targetId }
                });
            }
            continue;
        }

        console.log(`\n📦 Migrating Set: ${dbSet.name} (${dbSet.id} -> ${targetId})`);

        let setMigrationFailed = false;

        // --- STEP A: Copy Set Images (Logo/Symbol) ---
        // Note: Set images usually follow 'sets/id-logo.png'
        const setUpdates: any = { id: targetId, tcgdexId: targetId };

        if (dbSet.logoImageKey) {
            const newLogoKey = `sets/${targetId}-logo.png`;

            const oldOptPrefix = `optimized/${dbSet.logoImageKey.replace('.png', '')}/`;
            const newOptPrefix = `optimized/${newLogoKey.replace('.png', '')}/`;

            const s1 = await safeCopyS3Object(dbSet.logoImageKey, newLogoKey);
            const s2 = await safeCopyS3Folder(oldOptPrefix, newOptPrefix);

            if (!s1 || !s2) setMigrationFailed = true;
            setUpdates.logoImageKey = newLogoKey;
        }

        if (dbSet.symbolImageKey) {
            const newSymbolKey = `sets/${targetId}-symbol.png`;
            const oldOptPrefix = `optimized/${dbSet.symbolImageKey.replace('.png', '')}/`;
            const newOptPrefix = `optimized/${newSymbolKey.replace('.png', '')}/`;

            const s1 = await safeCopyS3Object(dbSet.symbolImageKey, newSymbolKey);
            const s2 = await safeCopyS3Folder(oldOptPrefix, newOptPrefix);

            if (!s1 || !s2) setMigrationFailed = true;
            setUpdates.symbolImageKey = newSymbolKey;
        }

        // --- STEP B: Copy Card Images ---
        const cards = await prisma.card.findMany({ where: { setId: dbSet.id } });
        console.log(`    Processing ${cards.length} cards...`);

        for (const card of cards) {
            const parts = card.id.split('-');
            const numberPart = parts[parts.length - 1];
            const newCardId = `${targetId}-${numberPart}`;

            if (newCardId === card.id) continue;

            if (card.imageKey) {
                const newImageKey = `cards/${sanitizePublicId(newCardId)}.png`;

                const oldSanitizedId = card.imageKey.replace('cards/', '').replace('.png', '');
                const newSanitizedId = sanitizePublicId(newCardId);

                const oldOptPrefix = `optimized/cards/${oldSanitizedId}/`;
                const newOptPrefix = `optimized/cards/${newSanitizedId}/`;

                const s1 = await safeCopyS3Object(card.imageKey, newImageKey);
                const s2 = await safeCopyS3Folder(oldOptPrefix, newOptPrefix);

                if (!s1 || !s2) {
                    console.error(`    ❌ Failure copying images for card ${card.id}`);
                    setMigrationFailed = true;
                }
            }
        }

        // --- SAFETY CHECK ---
        if (setMigrationFailed) {
            console.error(`    🛑 ABORTING DB UPDATE for set ${dbSet.name} due to R2 copy errors.`);
            continue; // Skip DB update, move to next set
        }

        // --- STEP C: Execute Database Updates ---
        console.log(`    💾 Updating Database Records...`);

        try {
            await prisma.$transaction(
                async (tx) => {
                    await tx.set.update({
                        where: { id: dbSet.id },
                        data: setUpdates
                    });

                    for (const card of cards) {
                        const cardFromSdk = await tcgdex.fetch('cards', card.id);
                        const newCardId = cardFromSdk?.id || card.id;

                        if (newCardId === card.id) continue;

                        const newImageKey = card.imageKey
                            ? `cards/${sanitizePublicId(newCardId)}.png`
                            : null;

                        await tx.card.update({
                            where: { id: card.id }, // id is old here; setId updated via cascade
                            data: {
                                id: newCardId,
                                imageKey: newImageKey
                            }
                        });
                    }
                },
                { maxWait: 20000, timeout: 60000 }
            );
            console.log(`    ✅ DB Update Complete for ${targetId}`);
        } catch (e) {
            console.error(`    ❌ CRITICAL DB ERROR on ${targetId}.`, e);
            process.exit(1);
        }
    }

    console.log('\n🎉 Safe Migration Complete. Old files remain in R2 as backup.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
