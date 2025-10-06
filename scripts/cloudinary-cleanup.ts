// scripts/cloudinary-cleanup.ts
import 'dotenv/config';
import { cloudinary } from '../src/lib/cloudinary';

// ##################################################################
// #                           ! WARNING !                          #
// #         This is a destructive script. It will permanently      #
// #       delete images from your Cloudinary account.              #
// ##################################################################

// To delete the duplicates in your "Home" folder, set this to an empty string.
const PREFIX_TO_DELETE = 'cards/';

async function cleanupImages() {
    // CORRECTED: This safety check now allows an empty string, but prevents null/undefined.
    if (PREFIX_TO_DELETE === null || PREFIX_TO_DELETE === undefined) {
        console.error('Safety check: Prefix is null or undefined. Exiting.');
        return;
    }

    const target =
        PREFIX_TO_DELETE === '' ? 'the root folder ("Home")' : `prefix "${PREFIX_TO_DELETE}"`;
    console.log(`Preparing to delete all images from ${target}...`);

    try {
        let result;
        do {
            console.log('Sending delete command for the next batch...');
            result = await cloudinary.api.delete_resources_by_prefix(PREFIX_TO_DELETE, {
                resource_type: 'image',
                max_results: 500 // Process in batches of 500
            });

            if (result.partial) {
                console.log(
                    `Partial deletion complete, ${result.rate_limit_remaining} calls remaining. More images to delete...`
                );
            }
        } while (result.partial);

        // After deleting resources, optionally delete the folder if a prefix was specified
        if (PREFIX_TO_DELETE !== '') {
            try {
                console.log(`Attempting to delete folder "${PREFIX_TO_DELETE}"...`);
                await cloudinary.api.delete_folder(PREFIX_TO_DELETE);
            } catch (folderError) {
                if (folderError.error?.http_code === 404) {
                    console.log('Folder already deleted or did not exist.');
                } else {
                    throw folderError;
                }
            }
        }

        console.log(`\n-- ✅ Cleanup fully completed for ${target}. --`);
    } catch (error) {
        console.error('❌ An error occurred during cleanup:', error);
    }
}

cleanupImages();
