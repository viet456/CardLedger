import { Metadata } from 'next';
import CardPageView from './CardPageView';
import { Suspense } from 'react';
import { CardFilterControlsSkeleton } from '@/src/components/search/CardFilterControlsSkeleton';
import { CardGridSkeleton } from '@/src/components/cards/CardGridSkeleton';

export const metadata: Metadata = {
    title: 'All Cards | CardLedger',
    description:
        'Browse, search, and filter the entire Pokémon TCG database of over 19,000 cards. Find any card from any set.'
};

function CardsPageSkeleton() {
    return (
        <div className='flex flex-grow flex-col lg:flex-row lg:items-start'>
            {/* Sidebar Skeleton (Desktop Only) */}
            <aside className='hidden h-[calc(100vh-4rem)] w-[280px] shrink-0 flex-col border-r border-border bg-card/50 p-4 lg:sticky lg:top-16 lg:flex'>
                <div className='mb-4 shrink-0'>
                    {/* Title Skeleton */}
                    <div className='h-7 w-32 animate-pulse rounded bg-muted' />
                </div>
                {/* Sidebar Controls Skeleton (Includes Clear All button) */}
                <CardFilterControlsSkeleton layout='sidebar' />
            </aside>

            {/* Main Content Skeleton */}
            <main className='flex min-h-screen flex-1 flex-col gap-2 lg:px-6 lg:pt-4'>
                {/* Mobile Header Skeleton (Mobile Only) */}
                <div className='px-4 pt-4 lg:hidden'>
                    <CardFilterControlsSkeleton layout='row' />
                    <div className='mt-2 flex items-center justify-between'>
                        <div className='h-5 w-32 animate-pulse rounded bg-muted' />
                    </div>
                </div>

                {/* Desktop Header Skeleton (Count + Badges row) */}
                <div className='mb-2 hidden min-h-[32px] items-center gap-3 lg:flex'>
                    <div className='h-5 w-40 animate-pulse rounded bg-muted' />
                </div>

                {/* Grid Skeleton */}
                <div className='mt-2 flex-grow px-4 lg:mt-0 lg:px-0'>
                    <CardGridSkeleton />
                </div>
            </main>
        </div>
    );
}

export default function CardsPage() {
    return (
        <Suspense fallback={<CardsPageSkeleton />}>
            <CardPageView />
        </Suspense>
    );
}
