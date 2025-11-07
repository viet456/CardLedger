import { Metadata } from 'next';
import CardPageView from './CardPageView';
import { Suspense } from 'react';
import { PokemonCardSkeleton } from '@/src/components/cards/PokemonCardSkeleton';

export const metadata: Metadata = {
    title: 'All Cards | CardLedger',
    description:
        'Browse, search, and filter the entire Pokémon TCG database of over 19,000 cards. Find any card from any set.'
};

function CardsPageSkeleton() {
    return (
        <div className='flex w-full flex-grow flex-col'>
            {/* Skeleton for CardFilterControls */}
            <div className='animate-pulse px-4 pt-2'>
                {/* Searchbar Skeleton */}
                <div className='h-10 w-full rounded bg-muted'></div>
                {/* Sort Order Skeleton */}
                <div className='mb-4 grid grid-cols-2 gap-4'>
                    <div className='h-10 rounded bg-muted'></div>
                    <div className='h-10 rounded bg-muted'></div>
                </div>
                {/* Filter Button Skeleton */}
                <div className='my-2 h-10 w-full rounded bg-muted'></div>
            </div>
            {/* Skeleton for CardGrid */}
            <div className='mt-2 min-h-screen flex-grow'>
                <div className='grid grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
                    {Array.from({ length: 20 }).map((_, i) => (
                        <PokemonCardSkeleton key={i} />
                    ))}
                </div>
            </div>
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
