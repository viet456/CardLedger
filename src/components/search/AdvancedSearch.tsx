'use client';

import { useSearchStore } from '@/src/lib/store/searchStore';
import { SearchBar } from './SearchBar';
import { FindCardsParams } from '@/src/services/pokemonCardService';
import { useEffect, useMemo } from 'react';
import { DenormalizedCard, FilterOptions, SetObject } from '@/src/shared-types/card-index';
import {
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetHeader,
    SheetTitle
} from '@/src/components/ui/sheet';
import { CardGrid } from '../cards/CardGrid';
import { SortableKey } from '@/src/services/pokemonCardValidator';

type SortOption = {
    label: string;
    value: SortableKey;
};
interface AdvancedSearchProps {
    initialCards: DenormalizedCard[];
    filterOptions: FilterOptions & { sets?: SetObject[] }; // sets made filterable too
    sortOptions: SortOption[];
    defaultSort?: {
        sortBy: SortableKey;
        sortOrder: 'asc' | 'desc';
    };
}
export function AdvancedSearch({
    initialCards,
    filterOptions,
    sortOptions,
    defaultSort
}: AdvancedSearchProps) {
    const { filters, setFilters } = useSearchStore();
    useEffect(() => {
        if (!filters.sortBy && defaultSort) {
            setFilters(defaultSort);
        }
    }, [filters.sortBy, defaultSort, setFilters]);

    const filteredCards = useMemo(() => {
        if (!initialCards || initialCards.length === 0) return [];
        // filtering
        const results = initialCards.filter((card) => {
            const searchFilter = filters.search?.toLowerCase();
            if (searchFilter && !card.n.toLowerCase().includes(searchFilter)) return false;
            if (filters.rarity && card.rarity !== filters.rarity) return false;
            if (filters.setId && card.set.id !== filters.setId) return false;
            if (filters.type && !card.types.includes(filters.type)) return false;
            if (filters.subtype && !card.subtypes.includes(filters.subtype)) return false;
            if (filters.artist && card.artist !== filters.artist) return false;
            return true;
        });
        // Only sort if the user has selected a sort option.
        // Otherwise, respect the pre-sorted order from the JSON file.
        if (filters.sortBy) {
            const sortBy = (filters.sortBy || 'rD') as SortableKey;
            const sortOrder = filters.sortOrder || 'desc';
            // return back to original, presorted data
            if (sortBy === 'rD' && sortOrder === 'desc') {
                return results;
            }
            results.sort((a, b) => {
                switch (sortBy) {
                    case 'n': // 'name' -> 'n'
                        const nameDiff = a.n.localeCompare(b.n);
                        // If names are the same, sort by release date
                        if (nameDiff !== 0) return nameDiff;
                        return (
                            new Date(a.set.releaseDate).getTime() -
                            new Date(b.set.releaseDate).getTime()
                        );
                    case 'pS': // 'pokedexNumberSort' -> 'pS'
                        // Handle nulls by pushing them to the end
                        const pokedexDiff = (a.pS || 9999) - (b.pS || 9999);
                        if (pokedexDiff !== 0) return pokedexDiff;
                        return (
                            new Date(a.set.releaseDate).getTime() -
                            new Date(b.set.releaseDate).getTime()
                        );
                    case 'rD': // 'releaseDate' -> 'rD'
                    default:
                        const dateDiff =
                            new Date(a.set.releaseDate).getTime() -
                            new Date(b.set.releaseDate).getTime();
                        if (dateDiff !== 0) return dateDiff;
                        return b.num.localeCompare(a.num, undefined, { numeric: true });
                }
            });
            if (sortOrder === 'desc') {
                results.reverse();
            }
        }
        return results;
    }, [initialCards, filters]);

    const handleFilterChange = (key: keyof FindCardsParams, value: string | number) => {
        const finalValue =
            value === '' || (typeof value === 'number' && isNaN(value)) ? undefined : value;
        setFilters({ [key]: finalValue });
    };

    const filterConfig = [
        { label: 'Types', key: 'type', options: filterOptions.types || [] },
        { label: 'Subtypes', key: 'subtype', options: filterOptions.subtypes || [] },
        { label: 'Rarities', key: 'rarity', options: filterOptions.rarities || [] },
        { label: 'Artists', key: 'artist', options: filterOptions.artists || [] },
        { label: 'Weaknesses', key: 'weaknessType', options: filterOptions.types || [] },
        { label: 'Resistances', key: 'resistanceType', options: filterOptions.types || [] },
        { label: 'Sets', key: 'setId', options: filterOptions.sets || [] }
    ];

    return (
        <div className='flex flex-grow flex-col'>
            <div className='flex-shrink-0 px-4 pt-2'>
                <SearchBar />
                <section className='grid grid-cols-2 gap-4' aria-label='Sort options'>
                    <div className='mb-4'>
                        <label htmlFor='sortBySelect'>Sort By:</label>
                        <select
                            id='sortBySelect'
                            value={filters.sortBy || defaultSort?.sortBy || ''}
                            onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                            className='w-full rounded bg-primary text-primary-foreground'
                        >
                            {sortOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className='mb-4'>
                        <label htmlFor='sortOrderSelect'>Order:</label>
                        <select
                            id='sortOrderSelect'
                            value={filters.sortOrder || 'desc'}
                            onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                            className='w-full rounded bg-primary text-primary-foreground'
                        >
                            <option value='asc'>Ascending</option>
                            <option value='desc'>Descending</option>
                        </select>
                    </div>
                </section>

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
                                        value={(
                                            filters[filter.key as keyof typeof filters] || ''
                                        ).toString()}
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
                                        {filter.options?.map((option, index) => {
                                            const isSetObject =
                                                typeof option === 'object' &&
                                                option !== null &&
                                                'id' in option;
                                            const value = isSetObject
                                                ? (option as { id: string; name: string }).id
                                                : (option as string);
                                            const label = isSetObject
                                                ? (option as { id: string; name: string }).name
                                                : (option as string);
                                            const key = isSetObject
                                                ? (option as { id: string; name: string }).id
                                                : `${label}-${index}`;
                                            return (
                                                <option key={key} value={value}>
                                                    {label}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>

            <div className='mt-2 min-h-0 flex-grow'>
                <CardGrid
                    cards={filteredCards}
                    isLoading={false} // managed by parent page.tsx
                    totalCount={filteredCards.length}
                />
            </div>
        </div>
    );
}
