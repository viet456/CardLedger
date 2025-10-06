import { ListObjectsV2Command, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';
import { cloudinary } from '../src/lib/cloudinary';

const R2_BUCKET_NAME = 'cardledger';
const R2_PUBLIC_URL = 'https://assets.cardledger.io';

function sanitizePublicId(id: string): string {
    const characterMap: { [key: string]: string } = {
        '?': 'question',
        '!': 'exclamation'
    };
    const regex = new RegExp(
        Object.keys(characterMap)
            .map((c) => `\\${c}`)
            .join('|'),
        'g'
    );
    return id.replace(regex, (match) => `_${characterMap[match]}`);
}

async function getAllCloudinaryPublicIds(prefix: string): Promise<Set<string>> {
    console.log('Fetching existing image IDs from Cloudinary...');
    const publicIds = new Set<string>();
    let nextCursor: string | undefined = undefined;

    while (true) {
        const result = await cloudinary.api.resources({
            type: 'upload',
            prefix: prefix,
            max_results: 500,
            next_cursor: nextCursor
        });

        result.resources.forEach((resource: { public_id: string }) => {
            publicIds.add(resource.public_id);
        });

        if (!result.next_cursor) {
            break;
        }
        nextCursor = result.next_cursor;
    }
    console.log(` -> Found ${publicIds.size} existing images in Cloudinary.`);
    return publicIds;
}

async function migratePrefix(r2Prefix: string, cloudinaryPrefix: string) {
    console.log(
        `\n--- Migrating R2 prefix "${r2Prefix}" to Cloudinary prefix "${cloudinaryPrefix}" ---`
    );
    const existingCloudinaryIds = await getAllCloudinaryPublicIds(cloudinaryPrefix);
    let continuationToken: string | undefined = undefined;
    let totalMigrated = 0;
    let totalSkipped = 0;

    while (true) {
        console.log('Fetching a batch of objects from R2...');
        const command = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            Prefix: r2Prefix,
            ContinuationToken: continuationToken
        });

        const { Contents, NextContinuationToken }: ListObjectsV2CommandOutput =
            await r2.send(command);

        if (!Contents || Contents.length === 0) {
            break;
        }

        const uploadPromises = Contents.map(async (obj) => {
            if (!obj.Key || obj.Key.endsWith('/')) return; // Skip folders
            const baseId = obj.Key.replace(r2Prefix, '').replace(/\.[^/.]+$/, '');
            const sanitizedId = sanitizePublicId(baseId);
            const publicId = `${cloudinaryPrefix}${sanitizedId}`;

            if (existingCloudinaryIds.has(publicId)) {
                totalSkipped++;
                return; // skip the upload entirely
            }
            const r2Url = `${R2_PUBLIC_URL}/${obj.Key}`;
            try {
                console.log(` -> Uploading ${r2Url} to Cloudinary with Public ID: ${publicId}`);
                await cloudinary.uploader.upload(r2Url, {
                    public_id: publicId,
                    resource_type: 'image',
                    overwrite: false // Don't re-upload if it already exists
                });
                totalMigrated++;
            } catch (error) {
                console.error(`Failed to upload ${obj.Key}:`, error);
            }
        });

        await Promise.all(uploadPromises);
        console.log(`Batch complete. Migrated: ${totalMigrated}, Skipped: ${totalSkipped}`);

        if (!NextContinuationToken) {
            break; // This was the last page
        }
        continuationToken = NextContinuationToken;
    }

    console.log(
        `--- Migration for "${r2Prefix}" complete! New: ${totalMigrated}, Skipped: ${totalSkipped} ---`
    );
}

async function runAllMigrations() {
    // Migrate R2's 'cards/' folder to Cloudinary's root folder
    await migratePrefix('cards/', 'home/');
    // Migrate R2's 'sets/' folder to Cloudinary's 'sets/' folder
    await migratePrefix('sets/', 'sets/');
}

runAllMigrations().catch(console.error);
