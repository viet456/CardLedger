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
import { useEffect, useRef, useMemo } from 'react';
import { findCardsInputSchema } from '@/src/services/pokemonCardValidator';
import { cn } from '@/src/lib/utils';
import { Layers, X } from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';

export default function CardPageView() {
    const isHydrated = useHasHydrated();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const { filters, replaceFilters, setFilters } = useSearchStore(
        useShallow((state) => ({
            filters: state.filters,
            replaceFilters: state.replaceFilters,
            setFilters: state.setFilters
        }))
    );

    const isUpdatingUrl = useRef(false);
    const isUpdatingStore = useRef(false);

    // Sync URL -> Store
    useEffect(() => {
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

    // Sync Store -> URL
    useEffect(() => {
        if (isUpdatingStore.current) return;

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

    // Generate Active Badges for Desktop View
    const activeBadges = useMemo(() => {
        const badges = [];
        if (filters.setId) {
            const s = sets.find((set) => set.id === filters.setId);
            badges.push({ key: 'setId', label: 'Set', value: s ? s.name : filters.setId });
        }
        if (filters.type) badges.push({ key: 'type', label: 'Type', value: filters.type });
        if (filters.subtype)
            badges.push({ key: 'subtype', label: 'Subtype', value: filters.subtype });
        if (filters.rarity) badges.push({ key: 'rarity', label: 'Rarity', value: filters.rarity });
        if (filters.artist) badges.push({ key: 'artist', label: 'Artist', value: filters.artist });
        if (filters.weakness)
            badges.push({ key: 'weakness', label: 'Weakness', value: filters.weakness });
        if (filters.resistance)
            badges.push({ key: 'resistance', label: 'Resistance', value: filters.resistance });
        return badges;
    }, [filters, sets]);

    const handleRemoveBadge = (key: string) => {
        setFilters({ [key]: undefined });
    };

    return (
        <div className='flex flex-grow flex-col md:flex-row md:items-start'>
            {/* --- SIDEBAR (Desktop Only) --- */}
            <aside
                className={cn(
                    'hidden w-[280px] shrink-0 flex-col border-r border-border bg-card/50 md:flex',
                    'sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto p-4'
                )}
            >
                <div className='mb-4 shrink-0'>
                    <h1 className='flex items-center gap-2 text-xl font-bold'>
                        <Layers className='h-5 w-5' />
                        Card Database
                    </h1>
                </div>

                <div className='flex min-h-0 flex-col'>
                    <CardFilterControls
                        filterOptions={filterOptions}
                        sortOptions={allCardsSortOptions}
                        layout='sidebar'
                    />
                </div>
            </aside>

            {/* --- MAIN CONTENT --- */}
            <main className='flex min-h-screen flex-1 flex-col gap-2 md:px-6 md:pt-4'>
                {/* MOBILE FILTERS (Using Row Layout) */}
                <div className='px-4 pt-4 md:hidden'>
                    <CardFilterControls
                        filterOptions={filterOptions}
                        sortOptions={allCardsSortOptions}
                        layout='row'
                    />
                    <div className='mt-2 flex items-center justify-between'>
                        <p className='text-sm text-muted-foreground'>
                            Showing{' '}
                            <span className='font-medium text-foreground'>
                                {denormalizedAndSortedCards.length.toLocaleString()}
                            </span>{' '}
                            cards
                        </p>
                    </div>
                </div>

                {/* DESKTOP HEADER (Count + Badges inline) */}
                <div className='mb-2 hidden min-h-[32px] flex-wrap items-center gap-3 md:flex'>
                    <p className='shrink-0 text-sm text-muted-foreground'>
                        Showing{' '}
                        <span className='font-medium text-foreground'>
                            {denormalizedAndSortedCards.length.toLocaleString()}
                        </span>{' '}
                        cards
                    </p>

                    {/* Divider logic: Only show divider if badges exist */}
                    {activeBadges.length > 0 && (
                        <div className='mx-1 h-4 w-px shrink-0 bg-border' />
                    )}

                    {activeBadges.length > 0 && (
                        <div className='flex flex-wrap gap-2'>
                            {activeBadges.map((badge) => (
                                <Badge
                                    key={badge.key}
                                    variant='secondary'
                                    onClick={() => handleRemoveBadge(badge.key)}
                                    // CHANGE: Manually set lighter grays for hover
                                    className='cursor-pointer gap-1 border border-border bg-card px-2 py-1 text-sm font-normal text-foreground transition-colors duration-150 hover:bg-accent'
                                >
                                    <span className='font-semibold'>{badge.label}:</span>{' '}
                                    {badge.value}
                                    <X className='ml-1 h-3 w-3' />
                                </Badge>
                            ))}
                        </div>
                    )}
                </div>

                {/* CARD GRID */}
                <div className='mt-2 flex-grow md:mt-0'>
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
            </main>
        </div>
    );
}
