'use client';

import { useSearchStore } from '@/src/lib/store/searchStore';
import { trpc } from '@/src/utils/trpc';
import { SearchBar } from './SearchBar';
import { useDebounce } from '@/src/hooks/useDebounce';
import { FindCardsParams } from '@/src/services/pokemonCardService';
import { useEffect, useMemo, useCallback, useRef } from 'react';
import { PokemonCardType, ClientPokemonCardType } from '@/src/types/data';
import { PokemonCard } from '../ui/PokemonCard';
import { PokemonCardSkeleton } from '../ui/PokemonCardSkeleton';

import {
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetHeader,
    SheetTitle
} from '@/src/components/ui/sheet';
import { CardGrid } from '../ui/CardGrid';

export function AdvancedSearch() {
    const { filters, setFilters } = useSearchStore();
    const fetchingRef = useRef(false);
    const { data: filterOptions } = trpc.pokemonMetadata.getFilterOptions.useQuery();

    const debouncedFilters = useMemo(() => {
        return filters;
    }, [JSON.stringify(filters)]);
    const debouncedValue = useDebounce(debouncedFilters, 200);

    const { data, error, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
        trpc.pokemonCard.searchCards.useInfiniteQuery(
            // use infinitePrefetchQuery??
            debouncedValue,
            {
                getNextPageParam: (lastPage) => lastPage.nextCursor,
                staleTime: Infinity // keeps data fresh for 5 mins
            }
        );
    // flatten the trpc pages into a single array for React Virtuoso
    const flatCards = useMemo(
        () =>
            (data?.pages.flatMap((page) => page.cards) ?? []) as unknown as ClientPokemonCardType[],
        [data]
    );
    // console.log('Fetched cards:', flatCards);
    // skeleton rendering and intersection observer
    const totalCount = data?.pages[0].totalCount ?? 0;
    useEffect(() => {
        // When a fetch is no longer in progress, release our lock.
        if (!isFetchingNextPage) {
            fetchingRef.current = false;
        }
    }, [isFetchingNextPage]);
    const renderItem = useCallback(
        (index: number) => {
            const card = flatCards[index];
            const shouldFetchNextPage = index >= flatCards.length - 10; // A small buffer
            if (shouldFetchNextPage && hasNextPage && !isFetchingNextPage && !fetchingRef.current) {
                fetchingRef.current = true;
                fetchNextPage();
            }
            return card ? <PokemonCard card={card} /> : <PokemonCardSkeleton />;
        },
        [flatCards, hasNextPage, isFetchingNextPage, fetchNextPage]
    );

    const handleFilterChange = (key: keyof FindCardsParams, value: string | number) => {
        const finalValue =
            value === '' || (typeof value === 'number' && isNaN(value)) ? undefined : value;
        setFilters({ [key]: finalValue });
    };

    const filterConfig = [
        { label: 'Types', key: 'type', options: filterOptions?.types },
        { label: 'Subtypes', key: 'subtype', options: filterOptions?.subtypes },
        { label: 'Rarities', key: 'rarity', options: filterOptions?.rarities },
        { label: 'Artists', key: 'artist', options: filterOptions?.artists },
        { label: 'Weaknesses', key: 'weaknessType', options: filterOptions?.types },
        { label: 'Resistances', key: 'resistanceType', options: filterOptions?.types }
    ];
    return (
        <div className='flex flex-grow flex-col'>
            <div className='flex-shrink-0 px-4 py-2'>
                <SearchBar />
                <Sheet>
                    <SheetTrigger
                        aria-label='Open navigation menu'
                        className='my-2 w-full items-center justify-between rounded bg-accent p-2 text-accent-foreground transition-colors hover:bg-muted hover:text-muted-foreground'
                    >
                        Filters
                    </SheetTrigger>
                    <SheetContent side='bottom' className='px-4 pb-6 pt-2'>
                        <SheetHeader className='p-0'>
                            <SheetTitle>Filters</SheetTitle>
                        </SheetHeader>
                        <div className='grid grid-cols-2 gap-4 md:grid-cols-5'>
                            {filterConfig.map((filter) => (
                                <div key={filter.key}>
                                    <label htmlFor={filter.key}>{filter.label}: </label>
                                    <select
                                        name={filter.key}
                                        id={filter.key}
                                        value={
                                            filters[
                                                filter.key as
                                                    | 'type'
                                                    | 'subtype'
                                                    | 'rarity'
                                                    | 'artist'
                                            ]
                                        }
                                        className='w-full rounded bg-primary text-primary-foreground'
                                        autoFocus={false}
                                        onChange={(e) =>
                                            handleFilterChange(
                                                filter.key as keyof typeof filters,
                                                e.target.value
                                            )
                                        }
                                    >
                                        <option value=''>{`All ${filter.label}`}</option>
                                        {filter.options?.map((option) => (
                                            <option key={option.id} value={option.name}>
                                                {option.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            <div className='mt-2 min-h-0 flex-grow'>
                {isLoading && <p className='text-center'>Loading...</p>}
                {error && <p className='text-center text-red-500'>Error: {error.message}</p>}
                {!isLoading && !error && (
                    <CardGrid
                        //cards={flatCards}
                        totalCount={totalCount}
                        isFetchingNextPage={isFetchingNextPage}
                        itemRenderer={renderItem}
                        //prefetchTriggerRef={ref}
                    />
                )}
            </div>
        </div>
    );
}
