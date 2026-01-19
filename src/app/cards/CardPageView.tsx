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
import { useMemo, useEffect } from 'react';
import { FilterState, findCardsInputSchema } from '@/src/services/pokemonCardValidator';

export default function CardPageView() {
    const isHydrated = useHasHydrated();

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const filters = useMemo(() => {
        const paramsObj = Object.fromEntries(searchParams.entries());
        const parsed = findCardsInputSchema.safeParse(paramsObj);
        const data = parsed.success ? parsed.data : {};
        return {
            ...data,
            sortBy: data.sortBy || 'rD',
            sortOrder: data.sortOrder || 'desc'
        };
    }, [searchParams]);

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
        //{ label: 'Card Number', value: 'num' }
    ];
    const isLoading = !isHydrated || !status.startsWith('ready');

    const { filteredCards: normalizedFilteredCards } = useCardFilters(filters);
    const { denormalizedAndSortedCards } = useDenormalizedCards(normalizedFilteredCards, filters);

    return (
        <div className='flex w-full flex-grow flex-col'>
            {/* <CardDataInitializer /> */}
            <CardFilterControls
                filterOptions={filterOptions}
                sortOptions={allCardsSortOptions}
                currentFilters={filters}
                defaultSort='rD'
            />
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
