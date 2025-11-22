'use client';

import { useSearchStore, FilterState } from '@/src/lib/store/searchStore';
import { SearchBar } from './SearchBar';
import { FilterOptions, SetObject } from '@/src/shared-types/card-index';
import {
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetHeader,
    SheetTitle
} from '@/src/components/ui/sheet';
import { SortableKey } from '@/src/services/pokemonCardValidator';

type SortOption = {
    label: string;
    value: SortableKey;
};

interface CardFilterControlsProps {
    filterOptions: FilterOptions & { sets?: SetObject[] };
    sortOptions: SortOption[];
}

export function CardFilterControls({ filterOptions, sortOptions }: CardFilterControlsProps) {
    const { filters, setFilters } = useSearchStore();
    const handleFilterChange = (key: keyof FilterState, value: string | number) => {
        const finalValue =
            value === '' || (typeof value === 'number' && isNaN(value)) ? undefined : value;
        setFilters({ [key]: finalValue });
    };

    const dynamicSortOptions = [...sortOptions];
    if (filters.search) {
        dynamicSortOptions.unshift({ label: 'Relevance', value: 'relevance' as SortableKey });
    }
    const filterConfig = [
        { label: 'Types', key: 'type', options: filterOptions.types || [] },
        { label: 'Subtypes', key: 'subtype', options: filterOptions.subtypes || [] },
        { label: 'Rarities', key: 'rarity', options: filterOptions.rarities || [] },
        { label: 'Artists', key: 'artist', options: filterOptions.artists || [] },
        { label: 'Sets', key: 'setId', options: filterOptions.sets || [] },
        { label: 'Weaknesses', key: 'weakness', options: filterOptions.weaknesses || [] },
        { label: 'Resistances', key: 'resistance', options: filterOptions.resistances || [] }
    ].filter((filter) => filter.options && filter.options.length > 0);

    return (
        <div className='flex-shrink-0 px-4 pt-2'>
            {/* Search and filter button */}
            <section className='flex flex-grow gap-2' aria-label='Search and filter'>
                <div className='flex-grow'>
                    <SearchBar />
                </div>

                <Sheet>
                    <SheetTrigger
                        aria-label='Open search filters menu'
                        className='mt-0 flex-shrink-0 items-center justify-between rounded bg-accent p-2 px-10 text-accent-foreground transition-colors hover:bg-border md:px-16'
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
                                        className='w-full rounded bg-card text-card-foreground'
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
                                            const value =
                                                filter.key === 'setId' && isSetObject
                                                    ? (option as { id: string }).id
                                                    : isSetObject
                                                      ? (option as { name: string }).name
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
            </section>

            <div className='grid flex-grow grid-cols-2 gap-4' aria-label='Sort options'>
                <div className=''>
                    <label htmlFor='sortBySelect'>Sort By:</label>
                    <select
                        id='sortBySelect'
                        value={
                            filters.search ? filters.sortBy || 'relevance' : filters.sortBy || ''
                        }
                        onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                        className='w-full rounded bg-card text-card-foreground'
                    >
                        {dynamicSortOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className=''>
                    <label htmlFor='sortOrderSelect'>Order:</label>
                    <select
                        id='sortOrderSelect'
                        value={filters.sortOrder || 'desc'}
                        onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
                        className='w-full rounded bg-card text-card-foreground'
                    >
                        <option value='asc'>Ascending</option>
                        <option value='desc'>Descending</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
