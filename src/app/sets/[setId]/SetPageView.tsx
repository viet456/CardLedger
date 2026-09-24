'use client';
import { SortableKey, findCardsInputSchema } from '@/src/services/pokemonCardValidator';
import { resolveSort, sortDenormalizedCards } from '@/src/utils/cardSort';
import { CardFilterControls } from '@/src/components/search/CardFilterControls';
import { SimpleCardGrid } from '@/src/components/cards/SimpleCardGrid';
import { SetObject, FilterOptions, DenormalizedCard } from '@/src/shared-types/card-index';
import { useShallow } from 'zustand/react/shallow';
import { useSearchStore } from '@/src/lib/store/searchStore';
import { useEffect, useMemo, useState, useRef } from 'react';
import Image from 'next/image';
import { Calendar, Layers, Hash, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { cn } from '@/src/lib/utils';
import { Separator } from '@/src/components/ui/separator';
import { SetCollectionBreakdownDialog } from '@/src/components/collection/SetCollectionBreakdownDialog';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface SetPageViewProps {
    setInfo: SetObject;
    cards: DenormalizedCard[];
    filterOptions: FilterOptions;
}

// Set-page sort keys accepted from URL params (locked contract: cardSort.ts)
const SET_SORT_KEYS = ['num', 'n', 'price'] as const;

function useSetFilters(initialCards: DenormalizedCard[]) {
    const searchParams = useSearchParams();
    const { filters } = useSearchStore(useShallow((state) => ({ filters: state.filters })));

    // Locked sort contract (src/utils/cardSort.ts): URL params are the sole
    // sort authority; absent sort params -> page default 'num' 'asc' (matches SSR).
    const { sortBy: effectiveSortBy, sortOrder: effectiveSortOrder } = resolveSort(
        searchParams.get('sortBy'),
        searchParams.get('sortOrder'),
        SET_SORT_KEYS,
        'num'
    );

    const filteredAndSortedCards = useMemo(() => {
        const filtered = initialCards.filter((card) => {
            if (filters.search && !card.n.toLowerCase().includes(filters.search.toLowerCase()))
                return false;
            if (filters.rarity && card.rarity !== filters.rarity) return false;
            if (filters.type && !card.types.includes(filters.type)) return false;
            if (filters.subtype && !card.subtypes.includes(filters.subtype)) return false;
            if (filters.artist && card.artist !== filters.artist) return false;
            if (filters.weakness && !card.weaknesses.some((w) => w.type === filters.weakness))
                return false;
            if (filters.resistance && !card.resistances.some((r) => r.type === filters.resistance))
                return false;
            return true;
        });

        // Locked sort contract (src/utils/cardSort.ts) — SSR/CSR parity via the
        // shared comparator ('num' asc === generateCardIndex order).
        return sortDenormalizedCards(filtered, effectiveSortBy, effectiveSortOrder);
    }, [initialCards, filters, effectiveSortBy, effectiveSortOrder]);

    return { filteredAndSortedCards };
}

export function SetPageView({ setInfo, cards, filterOptions }: SetPageViewProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const { filters, replaceFilters } = useSearchStore(
        useShallow((state) => ({
            filters: state.filters,
            replaceFilters: state.replaceFilters
        }))
    );
    const [isInfoExpanded, setIsInfoExpanded] = useState(false);

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
            // Locked sort contract: carry URL values verbatim into the store —
            // no sort defaults are injected (missing keys -> page default).
            replaceFilters(parsed.data);
        } else {
            replaceFilters({} as Parameters<typeof replaceFilters>[0]);
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
        window.history.replaceState(null, '', `${pathname}?${params.toString()}`);
    }, [filters, 
        pathname,
    ]);

    // Cleanup
    useEffect(() => {
        return () => replaceFilters({});
    }, [replaceFilters]);

    const { filteredAndSortedCards } = useSetFilters(cards);

    const sortOptions: { label: string; value: SortableKey }[] = [
        { label: 'Card Number', value: 'num' },
        { label: 'Name', value: 'n' },
        { label: 'Price', value: 'price' }
    ];

    const releaseDate = new Date(setInfo.releaseDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    return (
        <div className='flex flex-grow flex-col gap-6 md:flex-row md:items-start md:gap-0'>
            {/* --- SIDEBAR (Desktop Only) --- */}
            <aside
                className={cn(
                    'hidden w-[280px] shrink-0 flex-col border-r border-border bg-card/50 md:flex',
                    'sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto p-4'
                )}
            >
                <div className='mb-4 shrink-0'>
                    <div className='mb-3 flex items-center gap-3'>
                        {setInfo.symbolImageKey ? (
                            <div className='relative h-8 w-8 shrink-0'>
                                <Image
                                    src={setInfo.symbolImageKey}
                                    alt='Symbol'
                                    fill
                                    className='object-contain'
                                />
                            </div>
                        ) : (
                            <Layers className='h-8 w-8 text-muted-foreground' />
                        )}
                        <h1 className='text-lg font-bold leading-tight'>{setInfo.name}</h1>
                    </div>

                    <div className='grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-muted-foreground'>
                        <div className='flex items-center gap-1.5' aria-label='Series'>
                            <Layers className='h-3.5 w-3.5' /> {setInfo.series}
                        </div>
                        <div className='flex items-center gap-1.5'>
                            <Calendar className='h-3.5 w-3.5' /> {releaseDate}
                        </div>
                        <div className='col-span-2 flex items-center gap-1.5'>
                            <Hash className='h-3.5 w-3.5' />
                            {setInfo.total} Cards
                        </div>
                    </div>

                    <SetCollectionBreakdownDialog setId={setInfo.id} setName={setInfo.name}>
                        <Button
                            variant='outline'
                            size='sm'
                            className='mt-3 w-full gap-2 dark:bg-secondary dark:hover:bg-zinc-700 border border-border'
                        >
                            <BarChart3 className='h-4 w-4' />
                            Collection Progress
                        </Button>
                    </SetCollectionBreakdownDialog>
                </div>

                <Separator className='mb-4 shrink-0' />

                <div className='flex min-h-0 flex-1 flex-col'>
                    <CardFilterControls
                        filterOptions={filterOptions}
                        sortOptions={sortOptions}
                        layout='sidebar'
                    />
                </div>
            </aside>

            {/* --- MAIN CONTENT --- */}
            <main className='flex min-h-screen flex-1 flex-col gap-0 md:gap-4 md:px-6 md:pt-4'>
                {/* MOBILE HEADER */}
                <div className='mx-4 mt-4 rounded-xl border border-border bg-card shadow-sm md:hidden'>
                    <div
                        className='flex cursor-pointer items-center justify-between p-4 hover:bg-muted/50'
                        onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                    >
                        <div className='flex items-center gap-2'>
                            <span className='text-lg font-bold'>{setInfo.name}</span>
                            <span className='rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground'>
                                {setInfo.total} Cards
                            </span>
                        </div>
                        {isInfoExpanded ? (
                            <ChevronUp className='h-5 w-5 text-muted-foreground' />
                        ) : (
                            <ChevronDown className='h-5 w-5 text-muted-foreground' />
                        )}
                    </div>
                    {isInfoExpanded && (
                        <div className='space-y-4 border-t border-border p-4'>
                            <div className='grid grid-cols-2 gap-2 text-sm'>
                                <div className='flex items-center gap-1.5' aria-label='Series'>
                                    <Layers className='h-3.5 w-3.5' /> {setInfo.series}
                                </div>
                                <div className='flex items-center gap-1.5'>
                                    <Calendar className='h-3.5 w-3.5' /> {releaseDate}
                                </div>
                                <div className='col-span-2 flex items-center gap-1.5'>
                                    <Hash className='h-3.5 w-3.5' />
                                    {setInfo.total} Cards
                                </div>
                            </div>
                            <SetCollectionBreakdownDialog setId={setInfo.id} setName={setInfo.name}>
                                <Button
                                    variant='outline'
                                    size='sm'
                                    className='w-full gap-2 dark:bg-secondary dark:hover:bg-zinc-700 border border-border'
                                >
                                    <BarChart3 className='h-4 w-4' />
                                    Collection Progress
                                </Button>
                            </SetCollectionBreakdownDialog>
                        </div>
                    )}
                </div>

                {/* MOBILE FILTERS */}
                <div className='px-4 pt-1 md:hidden'>
                    <CardFilterControls
                        filterOptions={filterOptions}
                        sortOptions={sortOptions}
                        layout='row'
                    />
                </div>

                <div className='flex items-center justify-between px-4 md:px-1'>
                    <p className='text-sm text-muted-foreground'>
                        Showing{' '}
                        <span className='font-medium text-foreground'>
                            {filteredAndSortedCards.length}
                        </span>{' '}
                        cards
                    </p>
                </div>

                <div className='px-4 md:px-0'>
                    <SimpleCardGrid cards={filteredAndSortedCards} />
                </div>
            </main>
        </div>
    );
}
