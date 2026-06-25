'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useCardStore } from '@/src/lib/store/cardStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { BreadcrumbSkeleton } from './Skeletons';

export function ClientCachedBreadcrumbFallback({ cardId }: { cardId: string }) {
    const hasHydrated = useHasHydrated();
    const { cardMap, sets } = useCardStore();
    
    const card = cardMap.get(cardId);

    if (!hasHydrated || !card || card.s === null || !sets[card.s]) {
        return <BreadcrumbSkeleton />;
    }

    const setObj = sets[card.s];

    return (
        <nav className='mb-6 flex items-center space-x-2 text-sm text-muted-foreground'>
            <Link href='/sets' className='hover:underline'>
                Sets
            </Link>
            <ChevronRight className='h-4 w-4' />
            <Link
                href={`/sets/${setObj.id}?sortBy=num&sortOrder=asc`}
                className='hover:underline'
            >
                {setObj.name}
            </Link>
        </nav>
    );
}