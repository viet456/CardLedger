'use client';
import { SortableKey } from '@/src/services/pokemonCardValidator';
import { CardFilterControls } from '@/src/components/search/CardFilterControls';
import { SimpleCardGrid } from '@/src/components/cards/SimpleCardGrid';
import { SetObject, FilterOptions } from '@/src/shared-types/card-index';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { useShallow } from 'zustand/react/shallow';
import { useSearchStore } from '@/src/lib/store/searchStore';
import { useEffect, useMemo } from 'react';
import { DenormalizedCard } from '@/src/shared-types/card-index';
import { useMarketStore } from '@/src/lib/store/marketStore';
import { PokemonCardSkeleton } from '@/src/components/cards/PokemonCardSkeleton';

interface SetPageViewProps {
    setInfo: SetObject;
    cards: DenormalizedCard[];
    filterOptions: FilterOptions;
}

// Local card filtering hook for ~200 cards
function useSetFilters(initialCards: DenormalizedCard[]) {
    const { filters } = useSearchStore(useShallow((state) => ({ filters: state.filters })));
    const { prices } = useMarketStore(useShallow((state) => ({ prices: state.prices })));

    const filteredAndSortedCards = useMemo(() => {
        // Add prices
        const cardsWithPrices = initialCards.map((card) => ({
            ...card,
            price: prices[card.id] ?? null
        }));

        // Apply Filters (on ~200 cards, instant)
        const filtered = cardsWithPrices.filter((card) => {
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
    }, [initialCards, filters, prices]);

    return { filteredAndSortedCards };
}

export function SetPageView({ setInfo, cards, filterOptions }: SetPageViewProps) {
    const isHydrated = useHasHydrated();
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
    const isLoading = !isHydrated;

    return (
        <div className='flex flex-grow flex-col'>
            <header className='flex gap-6 px-4 text-lg'>
                <h1 className='font-bold'>{setInfo.name}</h1>
                <p className='text-muted-foreground'>Series: {setInfo.series}</p>
            </header>
            <CardFilterControls filterOptions={filterOptions} sortOptions={sortOptions} />
            {isLoading ? (
                <div className='mt-4 grid grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
                    {Array.from({ length: 20 }).map((_, i) => (
                        <PokemonCardSkeleton key={i} />
                    ))}
                </div>
            ) : (
                <SimpleCardGrid cards={filteredAndSortedCards} />
            )}
        </div>
    );
}
