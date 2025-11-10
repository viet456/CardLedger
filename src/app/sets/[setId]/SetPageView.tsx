'use client';
import { SortableKey } from '@/src/services/pokemonCardValidator';
import { useCardFilters } from '@/hooks/useCardFilters';
import { CardFilterControls } from '@/src/components/search/CardFilterControls';
import { SimpleCardGrid } from '@/src/components/cards/SimpleCardGrid';
import { SetObject, FilterOptions } from '@/src/shared-types/card-index';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { useCardStore, CardStoreState } from '@/src/lib/store/cardStore';
import { useShallow } from 'zustand/react/shallow';
import { useSearchStore } from '@/src/lib/store/searchStore';
import { useEffect } from 'react';
import { useDenormalizedCards } from '@/hooks/useDenormalizedCards';
interface SetPageViewProps {
    setInfo: SetObject;
}

export function SetPageView({ setInfo }: SetPageViewProps) {
    const isHydrated = useHasHydrated();
    const { status, artists, rarities, types, subtypes } = useCardStore(
        useShallow((state: CardStoreState) => ({
            status: state.status,
            artists: state.artists,
            rarities: state.rarities,
            types: state.types,
            subtypes: state.subtypes
        }))
    );
    const { replaceFilters } = useSearchStore();
    const isLoading = !isHydrated || !status.startsWith('ready');

    useEffect(() => {
        replaceFilters({
            setId: setInfo.id,
            sortBy: 'num', // Set default sort for this page
            sortOrder: 'asc'
        });

        // On unmount, clear all filters
        return () => {
            replaceFilters({});
        };
    }, [setInfo.id, replaceFilters]);

    const sortOptions: { label: string; value: SortableKey }[] = [
        { label: 'Card Number', value: 'num' },
        { label: 'Name', value: 'n' },
        { label: 'Pokedex Number', value: 'pS' },
        { label: 'Price', value: 'price' }
    ];
    const filterOptions: FilterOptions = {
        rarities,
        types,
        subtypes,
        artists
    };
    const { filteredCards: normalizedFilteredCards } = useCardFilters({});
    const { denormalizedAndSortedCards } = useDenormalizedCards(normalizedFilteredCards);
    return (
        <div className='flex flex-grow flex-col'>
            <header className='flex gap-6 px-4 text-lg'>
                <h1 className='font-bold'>{setInfo.name}</h1>
                <p className='text-muted-foreground'>Series: {setInfo.series}</p>
            </header>
            <CardFilterControls filterOptions={filterOptions} sortOptions={sortOptions} />
            <SimpleCardGrid cards={denormalizedAndSortedCards} />
        </div>
    );
}
