import { Metadata } from 'next';
import CardPageView from './CardPageView';
import { Suspense } from 'react';

export const metadata: Metadata = {
    title: 'All Cards | CardLedger',
    description:
        'Browse, search, and filter the entire Pokémon TCG database of over 19,000 cards. Find any card from any set.'
};

function CardsPageSkeleton() {
    return (
        <div className='w-full'>
            {/* Skeleton for CardFilterControls */}
            <div className='animate-pulse px-4 pt-2'>
                <div className='h-10 w-full rounded bg-muted'></div>
                <div className='mt-4 grid grid-cols-2 gap-4'>
                    <div className='h-10 rounded bg-muted'></div>
                    <div className='h-10 rounded bg-muted'></div>
                </div>
                <div className='my-2 h-10 w-full rounded bg-muted'></div>
            </div>
            {/* Skeleton for CardGrid */}
            <div className='grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
                {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className='flex aspect-[2.5/3.5] w-full rounded-xl bg-muted' />
                ))}
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
