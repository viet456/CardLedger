'use client';

import { useSearchStore } from '@/src/lib/store/searchStore';
import { SearchBar } from './SearchBar';
import { FindCardsParams } from '@/src/services/pokemonCardService';
import { useEffect, useMemo } from 'react';
import { useCardStore } from '@/src/lib/store/cardStore';
import { useHasHydrated } from '@/src/hooks/useHasHydrated';

import {
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetHeader,
    SheetTitle
} from '@/src/components/ui/sheet';
import { CardGrid } from '../ui/CardGrid';

type DenormalizedCard = {
    id: string;
    n: string;
    hp: number | null;
    num: string;
    img: string | null;
    rD: string;
    pS: number | null;
    cRC: number | null;
    supertype: string;
    artist: string | null;
    rarity: string | null;
    set: { id: string; name: string };
    types: string[];
    subtypes: string[];
    weaknesses: string[];
    resistances: string[];
};

export function AdvancedSearch() {
    const { filters, setFilters } = useSearchStore();
    const {
        cards: allCards,
        artists,
        rarities,
        sets,
        types,
        subtypes,
        supertypes,
        status,
        initialize
    } = useCardStore();

    const isHydrated = useHasHydrated();
    useEffect(() => {
        if (isHydrated) {
            initialize();
        }
    }, [isHydrated, initialize]);

    const denormalizedCards: DenormalizedCard[] = useMemo(() => {
        if (!allCards || allCards.length === 0) return [];
        console.log("First card's image key:", allCards[0].img);
        return allCards.map((card) => ({
            id: card.id,
            n: card.n,
            hp: card.hp,
            num: card.num,
            img: card.img,
            rD: card.rD,
            pS: card.pS,
            cRC: card.cRC,
            artist: card.a !== null && card.a !== undefined ? artists[card.a] || null : null,
            rarity: card.r !== null && card.r !== undefined ? rarities[card.r] || null : null,
            set: sets[card.s] || { id: '', name: '' },
            supertype: supertypes[card.st] || '',
            subtypes: card.sb ? card.sb.map((id) => subtypes[id] || '').filter(Boolean) : [],
            types: card.t ? card.t.map((id) => types[id] || '').filter(Boolean) : [],
            weaknesses: card.w ? card.w.map((id) => types[id] || '').filter(Boolean) : [],
            resistances: card.rs ? card.rs.map((id) => types[id] || '').filter(Boolean) : []
        }));
    }, [allCards, artists, rarities, sets, types, subtypes, supertypes]);

    const filteredCards = useMemo(() => {
        if (denormalizedCards.length === 0) return [];
        return denormalizedCards.filter((card) => {
            const searchFilter = filters.search?.toLowerCase();
            if (searchFilter && !card.n.toLowerCase().includes(searchFilter)) return false;
            if (filters.rarity && card.rarity !== filters.rarity) return false;
            if (filters.setId && card.set.id !== filters.setId) return false;
            if (filters.type && !card.types.includes(filters.type)) return false;
            if (filters.subtype && !card.subtypes.includes(filters.subtype)) return false;
            if (filters.artist && card.artist !== filters.artist) return false;
            return true;
        });
    }, [denormalizedCards, filters]);

    const handleFilterChange = (key: keyof FindCardsParams, value: string | number) => {
        const finalValue =
            value === '' || (typeof value === 'number' && isNaN(value)) ? undefined : value;
        setFilters({ [key]: finalValue });
    };

    type FilterOption = string | { id: string; name: string };

    const filterConfig: Array<{
        label: string;
        key: string;
        options: FilterOption[];
    }> = [
        { label: 'Types', key: 'type', options: Object.values(types) },
        { label: 'Subtypes', key: 'subtype', options: Object.values(subtypes) },
        { label: 'Rarities', key: 'rarity', options: Object.values(rarities) },
        { label: 'Artists', key: 'artist', options: Object.values(artists) },
        { label: 'Weaknesses', key: 'weaknessType', options: Object.values(types) },
        { label: 'Resistances', key: 'resistanceType', options: Object.values(types) },
        { label: 'Sets', key: 'setId', options: Object.values(sets) }
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
                {status === 'loading' && <p className='text-center'>Loading...</p>}
                {status === 'error' && (
                    <p className='text-center text-red-500'>Error loading card data.</p>
                )}
                {status.startsWith('ready') && (
                    <CardGrid
                        cards={filteredCards}
                        isLoading={!status.startsWith('ready')}
                        totalCount={status.startsWith('ready') ? filteredCards.length : 12}
                    />
                )}
            </div>
        </div>
    );
}
