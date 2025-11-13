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
        <div className='flex w-full flex-grow flex-col'>
            {/* Skeleton for CardFilterControls */}
            <CardFilterControlsSkeleton />
            {/* Skeleton for CardGrid */}
            <CardGridSkeleton />
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
