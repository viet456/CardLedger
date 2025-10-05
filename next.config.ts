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
        qualities: [50, 75]
    },
    cloudinary: {
        image: {
            placeholder: true
        }
    }
};
export default nextConfig;
