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
import { useSearchStore, FilterState } from '@/src/lib/store/searchStore';
import { useEffect, useRef } from 'react';

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
    const isInitialMount = useRef(true);
    const hasLoadedFromUrl = useRef(false);

    useEffect(() => {
        if (hasLoadedFromUrl.current) return;
        hasLoadedFromUrl.current = true;
        const params = new URLSearchParams(searchParams.toString());
        const urlFilters: { [key: string]: string } = {};
        for (const [key, value] of params.entries()) {
            urlFilters[key] = value;
        }
        replaceFilters(urlFilters as Partial<FilterState>);
    }, [replaceFilters, searchParams]);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.set(key, String(value));
            }
        });
        router.replace(`${pathname}?${params.toString()}`);
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
    const filterOptions = { rarities, types, subtypes, artists, sets };
    const allCardsSortOptions: { label: string; value: SortableKey }[] = [
        { label: 'Release Date', value: 'rD' },
        { label: 'Name', value: 'n' },
        { label: 'Pokedex Number', value: 'pS' },
        { label: 'Price', value: 'price' }
        //{ label: 'Card Number', value: 'num' }
    ];
    const defaultSort = { sortBy: 'rD' as SortableKey, sortOrder: 'desc' as const };
    const isLoading = !isHydrated || !status.startsWith('ready');

    const { filteredCards: normalizedFilteredCards } = useCardFilters({ defaultSort });
    const { denormalizedAndSortedCards } = useDenormalizedCards(normalizedFilteredCards);

    return (
        <div className='flex w-full flex-grow flex-col'>
            {/* <CardDataInitializer /> */}
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
