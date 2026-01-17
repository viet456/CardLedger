'use client';

import * as React from 'react';
import { useSearchStore, FilterState } from '@/src/lib/store/searchStore';
import { SearchBar } from './SearchBar';
import { FilterOptions, SetObject } from '@/src/shared-types/card-index';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/src/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/src/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger
} from '@/src/components/ui/drawer';
import { SortableKey } from '@/src/services/pokemonCardValidator';

// --- Utility Hook ---
function useMediaQuery(query: string) {
    const [value, setValue] = React.useState(false);

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
}

export function CardFilterControls({ filterOptions, sortOptions }: CardFilterControlsProps) {
    const { filters, setFilters } = useSearchStore();
    const [open, setOpen] = React.useState(false);
    const isDesktop = useMediaQuery('(min-width: 768px)');

    const handleFilterChange = (key: keyof FilterState, value: string) => {
        const finalValue = value === 'all' ? undefined : value;
        setFilters({ [key]: finalValue });
    };

    const dynamicSortOptions = [...sortOptions];
    if (filters.search) {
        dynamicSortOptions.unshift({ label: 'Relevance', value: 'relevance' as SortableKey });
    }

    const filterConfig = [
        { label: 'Sets', key: 'setId', options: filterOptions.sets || [] },
        { label: 'Types', key: 'type', options: filterOptions.types || [] },
        { label: 'Subtypes', key: 'subtype', options: filterOptions.subtypes || [] },
        { label: 'Rarities', key: 'rarity', options: filterOptions.rarities || [] },
        { label: 'Artists', key: 'artist', options: filterOptions.artists || [] },
        { label: 'Weaknesses', key: 'weakness', options: filterOptions.weaknesses || [] },
        { label: 'Resistances', key: 'resistance', options: filterOptions.resistances || [] }
    ].filter((filter) => filter.options && filter.options.length > 0);

    const FilterFormContent = (
        <div className='grid grid-cols-1 gap-3 px-4 pt-2 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 md:px-0 md:pt-4'>
            {filterConfig.map((filter) => (
                <div key={filter.key} className='space-y-1'>
                    <label htmlFor={filter.key} className='text-sm font-medium leading-none'>
                        {filter.label}
                    </label>
                    <Select
                        value={(filters[filter.key as keyof typeof filters] || '').toString()}
                        onValueChange={(val) =>
                            handleFilterChange(filter.key as keyof FilterState, val)
                        }
                    >
                        <SelectTrigger id={filter.key} className='w-full bg-card'>
                            <SelectValue placeholder={`All ${filter.label}`} />
                        </SelectTrigger>
                        <SelectContent className='max-h-[20rem]'>
                            <SelectItem value='all'>All {filter.label}</SelectItem>
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

    return (
        <div className='flex-shrink-0 px-4 pt-2'>
            {/* Top Row: Search + Filter Trigger */}
            <section className='flex flex-grow gap-2' aria-label='Search and filter'>
                <div className='flex-grow'>
                    <SearchBar />
                </div>

                {isDesktop ? (
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button
                                variant='secondary'
                                className='!md:px-16 h-12 flex-shrink-0 gap-2 bg-accent !px-10 text-accent-foreground hover:bg-border'
                                aria-label='Open filters'
                            >
                                <SlidersHorizontal className='h-4 w-4' />
                                Filters
                            </Button>
                        </DialogTrigger>
                        <DialogContent className='max-h-[85vh] w-[95vw] max-w-3xl overflow-y-auto sm:w-full'>
                            <DialogHeader>
                                <DialogTitle>Filter Collection</DialogTitle>
                            </DialogHeader>
                            {FilterFormContent}
                        </DialogContent>
                    </Dialog>
                ) : (
                    <Drawer open={open} onOpenChange={setOpen}>
                        <DrawerTrigger asChild>
                            <Button
                                variant='secondary'
                                className='!md:px-16 h-12 flex-shrink-0 gap-2 bg-accent !px-10 text-accent-foreground hover:bg-border'
                                aria-label='Open filters'
                            >
                                <SlidersHorizontal className='h-4 w-4' />
                                Filters
                            </Button>
                        </DrawerTrigger>
                        <DrawerContent className='max-h-[90vh]'>
                            <DrawerHeader className='pb-2 text-left'>
                                <DrawerTitle>Filter Collection</DrawerTitle>
                            </DrawerHeader>
                            <div className='overflow-y-auto pb-6'>{FilterFormContent}</div>
                        </DrawerContent>
                    </Drawer>
                )}
            </section>

            {/* Bottom Row: Sort Controls */}
            <div className='mb-2 mt-1 grid grid-cols-2 gap-4' aria-label='Sort options'>
                <div className='space-y-1'>
                    <label className='text-base font-medium text-muted-foreground'>Sort By:</label>
                    <Select
                        value={
                            filters.search ? filters.sortBy || 'relevance' : filters.sortBy || ''
                        }
                        onValueChange={(val) => handleFilterChange('sortBy', val)}
                    >
                        <SelectTrigger
                            aria-label='Sort by'
                            className='border-input hover:bg-accent/50 w-full bg-card text-foreground'
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
                    <label className='text-base font-medium text-muted-foreground'>Order:</label>
                    <Select
                        // CHANGED: Default to '' so it shows the "Order" placeholder
                        value={filters.sortOrder || ''}
                        onValueChange={(val) => handleFilterChange('sortOrder', val)}
                    >
                        <SelectTrigger
                            aria-label='Sort order'
                            className='border-input hover:bg-accent/50 w-full bg-card text-foreground'
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
        </div>
    );
}
