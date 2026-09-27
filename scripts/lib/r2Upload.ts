import fetch from 'node-fetch';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../../src/lib/r2';

const BUCKET_NAME = process.env.R2_BUCKET_NAME!;

/**
 * Upload a remote image to R2 — shared image-upload helper for the populate
 * pipeline. Semantics preserved exactly: returns false on a non-ok fetch and
 * THROWS on upload errors (populate wraps this in withRetry).
 */
export async function uploadImageToR2(url: string, key: string): Promise<boolean> {
    try {
        const res = await fetch(url);
        if (!res.ok) return false;

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = res.headers.get('content-type') || 'image/png';

        await r2.send(
            new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                Body: buffer,
                ContentType: contentType
            })
        );
        return true;
    } catch (e) {
        console.error(`\n    ⚠️ R2 Upload Error for ${key}:`, (e as Error).message);
        throw e;
    }
}