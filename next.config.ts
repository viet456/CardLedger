import type { NextConfig } from 'next';
import { withSerwist } from "@serwist/turbopack";
import { cardRedirects } from './src/lib/cardRedirects';

const nextConfig: NextConfig = {
    cacheComponents: true,
    async redirects() {
        // Dedupe pipeline: 301s for merged card/set URLs (see src/lib/cardRedirects.ts)
        return cardRedirects.map(({ source, destination }) => ({
            source,
            destination,
            permanent: true
        }));
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
export default withSerwist(nextConfig);
