import { S3Client } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import https from 'https';
import dotenv from 'dotenv';

dotenv.config();

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;

const agent = new https.Agent({
    ciphers: 'DEFAULT:@SECLEVEL=1'
});

const S3 = new S3Client({
    region: 'auto',
    endpoint: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!
    },
    requestHandler: new NodeHttpHandler({
        httpsAgent: agent,
        connectionTimeout: 10000, // 10 seconds to connect
        requestTimeout: 20000 // 20 seconds for the request to complete
    })
});

export const r2 = S3;
