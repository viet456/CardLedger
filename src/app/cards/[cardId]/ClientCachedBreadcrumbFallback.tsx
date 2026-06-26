'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useCardStore } from '@/src/lib/store/cardStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { BreadcrumbSkeleton } from './Skeletons';

import { denormalizeSingleCard } from '@/src/utils/cardUtils';

export function ClientCachedBreadcrumbFallback({ cardId }: { cardId: string }) {
    const hasHydrated = useHasHydrated();
    const store = useCardStore();
    
    const card = store.cardMap.get(cardId);

    if (!hasHydrated || !card) {
        return <BreadcrumbSkeleton />;
    }

    const denormalized = denormalizeSingleCard(card, store);
    
    if (!denormalized.set) {
        return <BreadcrumbSkeleton />;
    }

    return (
        <nav className='mb-6 flex items-center space-x-2 text-sm text-muted-foreground'>
            <Link href='/sets' className='hover:underline'>
                Sets
            </Link>
            <ChevronRight className='h-4 w-4' />
            <Link
                href={`/sets/${denormalized.set.id}?sortBy=num&sortOrder=asc`}
                className='hover:underline'
            >
                {denormalized.set.name}
            </Link>
        </nav>
    );
}
