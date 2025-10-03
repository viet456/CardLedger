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
        ]
    }
};
export default nextConfig;
