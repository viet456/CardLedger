import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { DenormalizedCard } from '@/src/shared-types/card-index';

export function CardBreadcrumbs({ card }: { card: DenormalizedCard }) {
    return (
        <nav className='mb-6 flex items-center space-x-2 text-sm text-muted-foreground'>
            <Link href='/sets' className='hover:underline'>
                Sets
            </Link>
            <ChevronRight className='h-4 w-4' />
            <Link href={`/sets/${card.set.id}`} className='hover:underline'>
                {card.set.name}
            </Link>
        </nav>
    );
}
