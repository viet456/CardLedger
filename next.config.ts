import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    cacheComponents: true,
    experimental: {
        staleTimes: {
            dynamic: 300, // Keep dynamic card pages in browser memory for 5 mins
            static: 1800 // Keep pre-rendered pages for 30 mins
        }
    },
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
export default nextConfig;
