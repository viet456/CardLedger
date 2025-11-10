'use client';
import { SortableKey } from '@/src/services/pokemonCardValidator';
import { SetPageProps } from '@/src/shared-types/card-index';
import { useCardFilters } from '@/hooks/useCardFilters';
import { CardFilterControls } from '@/src/components/search/CardFilterControls';
import { SimpleCardGrid } from '@/src/components/cards/SimpleCardGrid';

export function SetPageView({ setInfo, cards, filterOptions }: SetPageProps) {
    const sortOptions: { label: string; value: SortableKey }[] = [
        { label: 'Card Number', value: 'num' },
        { label: 'Name', value: 'n' },
        { label: 'Pokedex Number', value: 'pS' },
        { label: 'Price', value: 'price' }
    ];
    const defaultSort = {
        sortBy: 'num' as SortableKey,
        sortOrder: 'asc' as const
    };
    const { filteredCards } = useCardFilters({ initialCards: cards, defaultSort });

    return (
        <div className='flex flex-grow flex-col'>
            <header className='flex gap-6 px-4 text-lg'>
                <h1 className='font-bold'>{setInfo.name}</h1>
                <p className='text-muted-foreground'>Series: {setInfo.series}</p>
            </header>
            <CardFilterControls filterOptions={filterOptions} sortOptions={sortOptions} />
            <SimpleCardGrid cards={filteredCards} />
        </div>
    );
}
