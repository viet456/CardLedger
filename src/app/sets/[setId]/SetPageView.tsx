'use client';
import { AdvancedSearch } from '@/src/components/search/AdvancedSearch';
import { SortableKey } from '@/src/services/pokemonCardValidator';
import { SetPageProps } from '@/src/shared-types/card-index';

export function SetPageView({ setInfo, cards, filterOptions }: SetPageProps) {
    const sortOptions: { label: string; value: SortableKey }[] = [
        { label: 'Card Number', value: 'num' },
        { label: 'Name', value: 'n' },
        { label: 'Pokedex Number', value: 'pS' }
    ];
    const defaultSort = {
        sortBy: 'num' as SortableKey,
        sortOrder: 'desc' as const
    };
    return (
        <div className='flex flex-grow flex-col p-4'>
            <header className='flex gap-6 px-4 text-lg'>
                <h1 className='font-bold'>{setInfo.name}</h1>
                <p className='text-muted-foreground'>Series: {setInfo.series}</p>
            </header>
            <AdvancedSearch
                initialCards={cards}
                filterOptions={filterOptions}
                sortOptions={sortOptions}
                defaultSort={defaultSort}
            />
        </div>
    );
}
