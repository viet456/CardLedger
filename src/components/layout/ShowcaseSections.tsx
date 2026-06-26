'use client';

import dynamic from 'next/dynamic';

const PortfolioShowcase = dynamic(
    () => import('./PortfolioShowcase'),
    { ssr: false }
);
const DatabaseShowcase = dynamic(
    () => import('./DatabaseShowcase'),
    { ssr: false }
);
const SyncShowcase = dynamic(
    () => import('./SyncShowcase').then((m) => m.SyncShowcase),
    { ssr: false }
);

export { PortfolioShowcase, DatabaseShowcase, SyncShowcase };