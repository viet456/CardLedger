import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'assets.cardledger.io',
                port: '',
                pathname: '/**'
            }
        ],
        qualities: [50, 75],
        deviceSizes: [640, 750, 828, 1080],
        imageSizes: [16, 32, 48, 64, 96],
        minimumCacheTTL: 31536000
    }
};
export default nextConfig;
