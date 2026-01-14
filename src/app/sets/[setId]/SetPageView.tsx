'use client';
import { SortableKey } from '@/src/services/pokemonCardValidator';
import { CardFilterControls } from '@/src/components/search/CardFilterControls';
import { SimpleCardGrid } from '@/src/components/cards/SimpleCardGrid';
import { SetObject, FilterOptions } from '@/src/shared-types/card-index';
import { useShallow } from 'zustand/react/shallow';
import { useSearchStore } from '@/src/lib/store/searchStore';
import { useEffect, useMemo } from 'react';
import { DenormalizedCard } from '@/src/shared-types/card-index';

interface SetPageViewProps {
    setInfo: SetObject;
    cards: DenormalizedCard[];
    filterOptions: FilterOptions;
}

// Local card filtering hook for ~200 cards
function useSetFilters(initialCards: DenormalizedCard[]) {
    const { filters } = useSearchStore(useShallow((state) => ({ filters: state.filters })));

    const filteredAndSortedCards = useMemo(() => {
        // Apply Filters (on ~200 cards, instant)
        const filtered = initialCards.filter((card) => {
            if (filters.search && !card.n.toLowerCase().includes(filters.search.toLowerCase())) {
                return false;
            }
            if (filters.rarity && card.rarity !== filters.rarity) {
                return false;
            }
            if (filters.type && !card.types.includes(filters.type)) {
                return false;
            }
            if (filters.subtype && !card.subtypes.includes(filters.subtype)) {
                return false;
            }
            if (filters.artist && card.artist !== filters.artist) {
                return false;
            }
            if (filters.weakness && !card.weaknesses.some((w) => w.type === filters.weakness)) {
                return false;
            }
            if (
                filters.resistance &&
                !card.resistances.some((r) => r.type === filters.resistance)
            ) {
                return false;
            }
            return true;
        });

        const sortBy = (filters.sortBy || 'num') as SortableKey;
        const sortOrder = filters.sortOrder || 'asc';

        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'price':
                    const priceA = a.price;
                    const priceB = b.price;
                    const isAInvalid = priceA === null || priceA === undefined;
                    const isBInvalid = priceB === null || priceB === undefined;
                    if (isAInvalid && isBInvalid) return 0;
                    if (isAInvalid) return 1; // Push nulls to the bottom
                    if (isBInvalid) return -1;
                    return sortOrder === 'desc' ? priceB - priceA : priceA - priceB;
                case 'n':
                    return a.n.localeCompare(b.n);
                case 'num':
                    return a.num.localeCompare(b.num, undefined, { numeric: true });
                case 'pS':
                    const pokedexDiff = (a.pS || 9999) - (b.pS || 9999);
                    if (pokedexDiff !== 0) return pokedexDiff;
                    return a.num.localeCompare(b.num, undefined, { numeric: true });
                case 'rD':
                default:
                    return a.num.localeCompare(b.num, undefined, { numeric: true });
            }
        });

        if (sortOrder === 'desc' && sortBy !== 'price' && sortBy !== 'rD') {
            filtered.reverse();
        }

        return filtered;
    }, [initialCards, filters]);

    return { filteredAndSortedCards };
}

export function SetPageView({ setInfo, cards, filterOptions }: SetPageViewProps) {
    const { replaceFilters } = useSearchStore();

    useEffect(() => {
        replaceFilters({
            sortBy: 'num', // Set default sort for this page
            sortOrder: 'asc'
        });

        // On unmount, clear all filters
        return () => {
            replaceFilters({});
        };
    }, [replaceFilters]);

    const { filteredAndSortedCards } = useSetFilters(cards);

    const sortOptions: { label: string; value: SortableKey }[] = [
        { label: 'Card Number', value: 'num' },
        { label: 'Name', value: 'n' },
        { label: 'Pokedex Number', value: 'pS' },
        { label: 'Price', value: 'price' }
    ];

    return (
        <div className='flex flex-grow flex-col'>
            <header className='flex gap-6 px-4 text-lg'>
                <h1 className='font-bold'>{setInfo.name}</h1>
                <p className='text-muted-foreground'>Series: {setInfo.series}</p>
            </header>
            <CardFilterControls filterOptions={filterOptions} sortOptions={sortOptions} />
            <SimpleCardGrid cards={filteredAndSortedCards} />
        </div>
    );
}
