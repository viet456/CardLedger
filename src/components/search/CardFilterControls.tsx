'use client';

import * as React from 'react';
import { useSearchStore, FilterState } from '@/src/lib/store/searchStore';
import { SearchBar } from './SearchBar';
import { FilterOptions, SetObject } from '@/src/shared-types/card-index';
import { SlidersHorizontal, X, RotateCcw } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/src/components/ui/select';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
    DrawerFooter,
    DrawerClose
} from '@/src/components/ui/drawer';
import { SortableKey } from '@/src/services/pokemonCardValidator';
import { CardFilterControlsSkeleton } from './CardFilterControlsSkeleton';

// --- Utility Hook ---
function useMediaQuery(query: string) {
    const [value, setValue] = React.useState<boolean | undefined>(undefined);

    React.useEffect(() => {
        function onChange(event: MediaQueryListEvent) {
            setValue(event.matches);
        }
        const result = matchMedia(query);
        result.addEventListener('change', onChange);
        setValue(result.matches); // Set initial value on mount
        return () => result.removeEventListener('change', onChange);
    }, [query]);

    return value;
}

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
    const [open, setOpen] = React.useState(false);

    // SWITCH POINT: Large screens (768px+) get the Toolbar.
    // Smaller screens get the Drawer.
    const isDesktop = useMediaQuery('(min-width: 768px)');

    const handleFilterChange = (key: keyof FilterState, value: string) => {
        const finalValue = value === 'all' ? undefined : value;
        setFilters({ [key]: finalValue });
    };

    const handleClearFilters = () => {
        setFilters({
            setId: undefined,
            type: undefined,
            subtype: undefined,
            rarity: undefined,
            artist: undefined,
            weakness: undefined,
            resistance: undefined
        });
        setOpen(false);
    };

    const dynamicSortOptions = [...sortOptions];
    if (filters.search) {
        dynamicSortOptions.unshift({ label: 'Relevance', value: 'relevance' as SortableKey });
    }

    const filterConfig = [
        { label: 'Set', key: 'setId', options: filterOptions.sets || [] },
        { label: 'Type', key: 'type', options: filterOptions.types || [] },
        { label: 'Subtype', key: 'subtype', options: filterOptions.subtypes || [] },
        { label: 'Rarity', key: 'rarity', options: filterOptions.rarities || [] },
        { label: 'Artist', key: 'artist', options: filterOptions.artists || [] },
        { label: 'Weakness', key: 'weakness', options: filterOptions.weaknesses || [] },
        { label: 'Resistance', key: 'resistance', options: filterOptions.resistances || [] }
    ].filter((filter) => filter.options && filter.options.length > 0);

    // --- Active Filter Logic ---
    const activeFilters = React.useMemo(() => {
        const active = [];
        for (const config of filterConfig) {
            const currentValue = filters[config.key as keyof FilterState];
            if (currentValue) {
                let label = currentValue;
                if (config.key === 'setId' && filterOptions.sets) {
                    const setObj = filterOptions.sets.find((s) => s.id === currentValue);
                    if (setObj) label = setObj.name;
                }

                active.push({
                    key: config.key as keyof FilterState,
                    label: config.label,
                    displayValue: String(label)
                });
            }
        }
        return active;
    }, [filters, filterConfig, filterOptions.sets]);

    if (isDesktop === undefined) {
        return <CardFilterControlsSkeleton />;
    }

    const MobileFilterContent = (
        <div className='grid grid-cols-1 gap-2 px-4 sm:grid-cols-2'>
            {filterConfig.map((filter) => (
                <div key={filter.key} className='space-y-1'>
                    <label
                        htmlFor={`mobile-${filter.key}`}
                        className='text-sm font-medium leading-none'
                    >
                        {filter.label}
                    </label>
                    <Select
                        value={(filters[filter.key as keyof typeof filters] || '').toString()}
                        onValueChange={(val) =>
                            handleFilterChange(filter.key as keyof FilterState, val)
                        }
                    >
                        <SelectTrigger id={`mobile-${filter.key}`} className='w-full bg-card'>
                            <SelectValue placeholder={`All ${filter.label}s`} />
                        </SelectTrigger>
                        <SelectContent className='max-h-[20rem]'>
                            <SelectItem value='all'>All {filter.label}s</SelectItem>
                            {filter.options?.map((option, index) => {
                                const isSetObject =
                                    typeof option === 'object' && option !== null && 'id' in option;
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
                                    <SelectItem key={key} value={value}>
                                        {label}
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                </div>
            ))}
        </div>
    );

    const DesktopToolbar = (
        <div className='mt-2 flex flex-wrap gap-2'>
            {filterConfig.map((filter) => (
                <div key={filter.key} className='max-w-[240px] flex-grow basis-[150px]'>
                    <Select
                        value={(filters[filter.key as keyof typeof filters] || '').toString()}
                        onValueChange={(val) =>
                            handleFilterChange(filter.key as keyof FilterState, val)
                        }
                    >
                        <SelectTrigger className='h-10 w-full border border-border bg-card text-sm'>
                            <SelectValue placeholder={filter.label} />
                        </SelectTrigger>
                        <SelectContent className='max-h-[20rem]'>
                            <SelectItem value='all'>All {filter.label}s</SelectItem>
                            {filter.options?.map((option, index) => {
                                const isSetObject =
                                    typeof option === 'object' && option !== null && 'id' in option;
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
                                    <SelectItem key={key} value={value}>
                                        {label}
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                </div>
            ))}

            {/* Reset Button - Always visible on Desktop */}
            <Button
                variant='secondary'
                onClick={handleClearFilters}
                className='hover:text-destructive hover:bg-destructive/10 h-9 max-w-[140px] flex-grow basis-[100px] border border-border bg-card text-muted-foreground'
            >
                <RotateCcw className='mr-2 h-4 w-4' />
                Reset
            </Button>
        </div>
    );

    return (
        <div className='flex-shrink-0 px-4 pt-2'>
            <section aria-label='Search and filter'>
                <div className='flex gap-2'>
                    {/* Search Bar - Grows to fill space */}
                    <div className='flex-grow'>
                        <SearchBar />
                    </div>

                    {/* MOBILE/TABLET TOGGLE */}
                    {!isDesktop && (
                        <Drawer open={open} onOpenChange={setOpen}>
                            <DrawerTrigger asChild>
                                <Button
                                    variant='secondary'
                                    className='h-12 flex-shrink-0 gap-2 bg-accent px-8 text-accent-foreground hover:bg-border'
                                >
                                    <SlidersHorizontal className='h-4 w-4' />
                                    Filters
                                    {/* Badges on Button (Mobile only) */}
                                    {activeFilters.length > 0 && (
                                        <Badge
                                            variant='default'
                                            className='ml-1 h-5 w-5 justify-center rounded-full p-0 text-[10px]'
                                        >
                                            {activeFilters.length}
                                        </Badge>
                                    )}
                                </Button>
                            </DrawerTrigger>
                            <DrawerContent className='h-auto max-h-[90vh]'>
                                <DrawerHeader className='pb-2 text-left'>
                                    <DrawerTitle>Filter Collection</DrawerTitle>
                                </DrawerHeader>
                                <div className='pb-0'>{MobileFilterContent}</div>
                                <DrawerFooter>
                                    <Button variant='outline' onClick={handleClearFilters}>
                                        Reset
                                    </Button>
                                    <DrawerClose asChild>
                                        <Button>Done</Button>
                                    </DrawerClose>
                                </DrawerFooter>
                            </DrawerContent>
                        </Drawer>
                    )}
                </div>
                {isDesktop && DesktopToolbar}
            </section>

            {/* Sort Controls */}
            <div className='mb-2 grid grid-cols-2 gap-4' aria-label='Sort options'>
                <div className='space-y-1'>
                    <label className='text-sm font-medium text-muted-foreground'>Sort By:</label>
                    <Select
                        value={
                            filters.search ? filters.sortBy || 'relevance' : filters.sortBy || ''
                        }
                        onValueChange={(val) => handleFilterChange('sortBy', val)}
                    >
                        <SelectTrigger
                            aria-label='Sort by'
                            className='border-input hover:bg-accent/50 w-full border border-border bg-card text-foreground'
                        >
                            <SelectValue placeholder='Sort By' />
                        </SelectTrigger>
                        <SelectContent>
                            {dynamicSortOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className='space-y-1'>
                    <label className='text-sm font-medium text-muted-foreground'>Order:</label>
                    <Select
                        value={filters.sortOrder || ''}
                        onValueChange={(val) => handleFilterChange('sortOrder', val)}
                    >
                        <SelectTrigger
                            aria-label='Sort order'
                            className='hover:bg-accent/50 w-full border border-border bg-card text-foreground'
                        >
                            <SelectValue placeholder='Order' />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='asc'>Ascending</SelectItem>
                            <SelectItem value='desc'>Descending</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Active Filter Badges (MOBILE ONLY) */}
            {activeFilters.length > 0 && !isDesktop && (
                <div className='mt-2 flex flex-wrap gap-2'>
                    {activeFilters.map((filter) => (
                        <Badge
                            key={filter.key}
                            variant='default'
                            className='hover:bg-destructive hover:text-destructive-foreground flex cursor-pointer items-center gap-1 border border-border bg-card px-3 py-1 text-sm font-normal text-foreground transition-colors'
                            onClick={() => handleFilterChange(filter.key, 'all')}
                        >
                            <span className='font-semibold'>{filter.label}:</span>
                            {filter.displayValue}
                            <X className='h-3 w-3' />
                        </Badge>
                    ))}
                    <Button
                        variant='ghost'
                        size='sm'
                        className='hover:text-destructive hover:bg-destructive/10 h-7 px-3 text-xs text-muted-foreground underline transition-colors'
                        onClick={handleClearFilters}
                    >
                        Clear All
                    </Button>
                </div>
            )}
        </div>
    );
}
