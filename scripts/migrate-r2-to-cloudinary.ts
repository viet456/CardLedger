import { ListObjectsV2Command, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';
import { cloudinary } from '../src/lib/cloudinary';

const R2_BUCKET_NAME = 'cardledger';
const R2_PUBLIC_URL = 'https://assets.cardledger.io';

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

async function migrateImages() {
    console.log('Starting migration from R2 to Cloudinary...');
    const existingCloudinaryIds = await getAllCloudinaryPublicIds('cards/');
    let continuationToken: string | undefined = undefined;
    let totalMigrated = 0;
    let totalSkipped = 0;

    while (true) {
        console.log('Fetching a batch of objects from R2...');
        const command = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            Prefix: 'cards/', // Only get files from the 'cards' folder
            ContinuationToken: continuationToken
        });

        const { Contents, NextContinuationToken }: ListObjectsV2CommandOutput =
            await r2.send(command);

        if (!Contents || Contents.length === 0) {
            console.log('No more objects found in R2.');
            break;
        }

        const uploadPromises = Contents.map(async (obj) => {
            if (!obj.Key) return;

            const r2Url = `${R2_PUBLIC_URL}/${obj.Key}`;

            // 'cards/base1-1.png' -> 'cards/base1-1'
            const publicId = obj.Key.replace(/\.[^/.]+$/, '');
            if (existingCloudinaryIds.has(publicId)) {
                totalSkipped++;
                return; // skip the upload entirely
            }

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

    console.log(`\n-- ✅ Migration complete! Total images migrated: ${totalMigrated} --`);
}

migrateImages().catch(console.error);
