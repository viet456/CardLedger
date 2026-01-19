'use client';
import { SortableKey } from '@/src/services/pokemonCardValidator';
import { useCardStore, CardStoreState } from '@/src/lib/store/cardStore';
import { CardFilterControls } from '@/src/components/search/CardFilterControls';
import { useCardFilters } from '@/hooks/useCardFilters';
import { CardGrid } from '@/src/components/cards/CardGrid';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { PokemonCardSkeleton } from '@/src/components/cards/PokemonCardSkeleton';
import { useDenormalizedCards } from '@/hooks/useDenormalizedCards';
import { useShallow } from 'zustand/react/shallow';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSearchStore } from '@/src/lib/store/searchStore';
import { useEffect, useRef } from 'react';
import { findCardsInputSchema } from '@/src/services/pokemonCardValidator';

export default function CardPageView() {
    const isHydrated = useHasHydrated();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const { filters, replaceFilters } = useSearchStore(
        useShallow((state) => ({
            filters: state.filters,
            replaceFilters: state.replaceFilters
        }))
    );

    const isUpdatingUrl = useRef(false);
    const isUpdatingStore = useRef(false);

    // Sync URL -> Store (when URL changes externally, like FilterLinks)
    useEffect(() => {
        // Don't update store if we just updated the URL
        if (isUpdatingUrl.current) {
            isUpdatingUrl.current = false;
            return;
        }

        isUpdatingStore.current = true;

        const paramsObj = Object.fromEntries(searchParams.entries());
        const parsed = findCardsInputSchema.safeParse(paramsObj);

        if (parsed.success) {
            const filtersWithDefaults = {
                sortBy: parsed.data.sortBy || 'rD',
                sortOrder: parsed.data.sortOrder || 'desc',
                ...parsed.data
            };
            replaceFilters(filtersWithDefaults);
        } else {
            replaceFilters({ sortBy: 'rD', sortOrder: 'desc' });
        }

        setTimeout(() => {
            isUpdatingStore.current = false;
        }, 0);
    }, [searchParams, replaceFilters]);

    // Sync Store -> URL (when filters change from UI)
    useEffect(() => {
        // Don't update URL if we just updated the store
        if (isUpdatingStore.current) {
            return;
        }

        isUpdatingUrl.current = true;

        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.set(key, String(value));
            }
        });

        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [filters, pathname, router]);

    const { status, artists, rarities, sets, types, subtypes } = useCardStore(
        useShallow((state: CardStoreState) => ({
            status: state.status,
            artists: state.artists,
            rarities: state.rarities,
            sets: state.sets,
            types: state.types,
            subtypes: state.subtypes
        }))
    );

    const filterOptions = {
        rarities,
        types,
        subtypes,
        artists,
        sets,
        weaknesses: types,
        resistances: types
    };

    const allCardsSortOptions: { label: string; value: SortableKey }[] = [
        { label: 'Release Date', value: 'rD' },
        { label: 'Name', value: 'n' },
        { label: 'Pokedex Number', value: 'pS' },
        { label: 'Price', value: 'price' }
    ];

    const defaultSort = { sortBy: 'rD' as SortableKey, sortOrder: 'desc' as const };
    const isLoading = !isHydrated || !status.startsWith('ready');

    const { filteredCards: normalizedFilteredCards } = useCardFilters({ defaultSort });
    const { denormalizedAndSortedCards } = useDenormalizedCards(normalizedFilteredCards);

    return (
        <div className='flex w-full flex-grow flex-col'>
            <CardFilterControls filterOptions={filterOptions} sortOptions={allCardsSortOptions} />
            <div className='mt-2 min-h-screen flex-grow'>
                {isLoading ? (
                    <div className='grid grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
                        {Array.from({ length: 20 }).map((_, i) => (
                            <PokemonCardSkeleton key={i} />
                        ))}
                    </div>
                ) : (
                    <CardGrid
                        cards={denormalizedAndSortedCards}
                        totalCount={denormalizedAndSortedCards.length}
                    />
                )}
            </div>
        </div>
    );
}
