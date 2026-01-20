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

function useMediaQuery(query: string) {
    const [value, setValue] = React.useState<boolean | undefined>(undefined);
    React.useEffect(() => {
        function onChange(event: MediaQueryListEvent) {
            setValue(event.matches);
        }
        const result = matchMedia(query);
        result.addEventListener('change', onChange);
        setValue(result.matches);
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
    layout?: 'row' | 'sidebar';
}

export function CardFilterControls({
    filterOptions,
    sortOptions,
    layout = 'row'
}: CardFilterControlsProps) {
    const { filters, setFilters } = useSearchStore();
    const [open, setOpen] = React.useState(false);
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
            resistance: undefined,
            search: ''
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
        return <CardFilterControlsSkeleton layout={layout} />;
    }

    const renderSelect = (filter: (typeof filterConfig)[0], fullWidth = false) => (
        <Select
            key={filter.key}
            value={(filters[filter.key as keyof typeof filters] || '').toString()}
            onValueChange={(val) => handleFilterChange(filter.key as keyof FilterState, val)}
        >
            <SelectTrigger
                className={`border-border bg-card text-sm ${fullWidth ? 'w-full' : 'h-10 w-full'}`}
            >
                <SelectValue placeholder={filter.label} className='truncate' />
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
    );

    // --- LAYOUTS ---

    const SidebarLayout = (
        <div className='flex flex-col gap-3'>
            {/* CHANGED: Removed h-full, flex-1, overflow-y-auto, pr-1. Simple vertical stack. */}

            {/* Top Area */}
            <div className='w-full shrink-0'>
                <SearchBar />
            </div>

            {/* Sort Controls */}
            <div className='grid min-w-0 shrink-0 grid-cols-[2fr_1fr] gap-2'>
                <div className='col-span-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>
                    Sort
                </div>

                <Select
                    value={filters.search ? filters.sortBy || 'relevance' : filters.sortBy || ''}
                    onValueChange={(val) => handleFilterChange('sortBy', val)}
                >
                    <SelectTrigger className='h-9 w-full border border-border bg-card'>
                        <SelectValue placeholder='Sort By' className='truncate' />
                    </SelectTrigger>
                    <SelectContent>
                        {dynamicSortOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select
                    value={filters.sortOrder || ''}
                    onValueChange={(val) => handleFilterChange('sortOrder', val)}
                >
                    <SelectTrigger className='h-9 w-full border border-border bg-card'>
                        <SelectValue placeholder='Order' className='truncate' />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='asc'>Asc</SelectItem>
                        <SelectItem value='desc'>Desc</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Filter Stack */}
            <div className='flex flex-col gap-3 pt-2'>
                <div className='text-[10px] font-bold uppercase tracking-wider text-muted-foreground'>
                    Filters
                </div>
                {filterConfig.map((filter) => (
                    <div key={filter.key} className='w-full'>
                        {renderSelect(filter, true)}
                    </div>
                ))}
            </div>

            {/* Bottom Button */}
            <Button
                variant='outline'
                onClick={handleClearFilters}
                className='mt-2 h-9 w-full shrink-0'
            >
                <RotateCcw className='mr-2 h-4 w-4' /> Clear All
            </Button>
        </div>
    );

    const MobileDrawerContent = (
        <div className='grid grid-cols-1 gap-2 px-4 sm:grid-cols-2'>
            {filterConfig.map((filter) => (
                <div key={filter.key} className='space-y-1'>
                    <label className='text-sm font-medium leading-none'>{filter.label}</label>
                    {renderSelect(filter, true)}
                </div>
            ))}
        </div>
    );

    const DesktopRowLayout = (
        <div className='mt-2 flex flex-wrap gap-2'>
            {filterConfig.map((filter) => (
                <div key={filter.key} className='max-w-[240px] flex-grow basis-[150px]'>
                    {renderSelect(filter)}
                </div>
            ))}
            <Button
                variant='secondary'
                onClick={handleClearFilters}
                className='hover:bg-destructive/10 hover:text-destructive h-10 max-w-[140px] flex-grow basis-[100px] border border-border bg-card text-muted-foreground'
            >
                <RotateCcw className='mr-2 h-4 w-4' /> Reset
            </Button>
        </div>
    );

    if (layout === 'sidebar' && isDesktop) {
        return SidebarLayout;
    }

    return (
        <div className='flex-shrink-0 pt-2 md:px-4'>
            <section aria-label='Search and filter'>
                <div className='flex gap-2'>
                    <div className='flex-grow'>
                        <SearchBar />
                    </div>

                    {!isDesktop && (
                        <Drawer open={open} onOpenChange={setOpen}>
                            <DrawerTrigger asChild>
                                <Button
                                    variant='secondary'
                                    className='h-12 flex-shrink-0 gap-2 bg-accent px-8 text-accent-foreground hover:bg-border'
                                >
                                    <SlidersHorizontal className='h-4 w-4' /> Filters
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
                                <div className='pb-0'>{MobileDrawerContent}</div>
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

                {isDesktop && layout === 'row' && DesktopRowLayout}
            </section>

            {(!isDesktop || layout === 'row') && (
                <div className='mb-2 mt-2 grid min-w-0 grid-cols-2 gap-2'>
                    <Select
                        value={
                            filters.search ? filters.sortBy || 'relevance' : filters.sortBy || ''
                        }
                        onValueChange={(val) => handleFilterChange('sortBy', val)}
                    >
                        <SelectTrigger className='w-full border border-border bg-card'>
                            <SelectValue placeholder='Sort By' className='truncate' />
                        </SelectTrigger>
                        <SelectContent>
                            {dynamicSortOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.sortOrder || ''}
                        onValueChange={(val) => handleFilterChange('sortOrder', val)}
                    >
                        <SelectTrigger className='w-full border border-border bg-card'>
                            <SelectValue placeholder='Order' className='truncate' />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value='asc'>Ascending</SelectItem>
                            <SelectItem value='desc'>Descending</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {activeFilters.length > 0 && (!isDesktop || layout === 'row') && (
                <div className='mt-2 flex flex-wrap gap-2'>
                    {activeFilters.map((filter) => (
                        <Badge
                            key={filter.key}
                            variant='default'
                            onClick={() => handleFilterChange(filter.key, 'all')}
                            className='cursor-pointer gap-1'
                        >
                            <span className='font-semibold'>{filter.label}:</span>{' '}
                            {filter.displayValue} <X className='h-3 w-3' />
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}
