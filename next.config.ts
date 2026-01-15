import type { NextConfig } from 'next';

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
export default nextConfig;
