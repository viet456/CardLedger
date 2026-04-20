import type { NextConfig } from 'next';
import { withSerwist } from "@serwist/turbopack";

const nextConfig: NextConfig = {
    cacheComponents: true,
    images: {
        loader: 'custom',
        loaderFile: './src/lib/loader.ts'
        // remotePatterns: [
        //     {
        //         protocol: 'https',
        //         hostname: 'assets.cardledger.io',
        //         port: '',
        //         pathname: '/**'
        //     }
        // ],
        // // Use Next.js image optimization
        // unoptimized: false,
    }
};
export default withSerwist(nextConfig);
