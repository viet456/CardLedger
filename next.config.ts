import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'pub-824918a696694722afa7ba2876533a1e.r2.dev'
            }
        ]
    }
};
export default nextConfig;
