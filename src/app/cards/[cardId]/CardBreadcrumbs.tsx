import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { getCachedCardData } from '@/src/app/cards/[cardId]/data';

export async function CardBreadcrumbs({ cardId }: { cardId: string }) {
    const card = await getCachedCardData(cardId);
    if (!card) return null;

    return (
        <nav className='mb-6 flex items-center space-x-2 text-sm text-muted-foreground'>
            <Link href='/sets' className='hover:underline'>
                Sets
            </Link>
            <ChevronRight className='h-4 w-4' />
            <Link
                href={`/sets/${card.set.id}?sortBy=num&sortOrder=asc`}
                className='hover:underline'
            >
                {card.set.name}
            </Link>
        </nav>
    );
}
