'use client';
import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSearchStore } from '@/src/lib/store/searchStore';
import { CardFilterControls } from '@/src/components/search/CardFilterControls';
import { SimpleCardGrid } from '@/src/components/cards/SimpleCardGrid';
import { DenormalizedCard, FilterOptions, SetObject } from '@/src/shared-types/card-index';
import { SortableKey } from '@/src/services/pokemonCardValidator';
// Modeled after /setId page view

interface DashboardCard extends DenormalizedCard {
    collectionStats?: {
        cost: number;
        acquiredAt: Date;
        condition: string;
    };
}

interface CollectionPageViewProps {
    cards: DashboardCard[];
}

function useCollectionFilters(initialCards: DashboardCard[]) {
    const { filters } = useSearchStore(useShallow((state) => ({ filters: state.filters })));

    const filteredAndSortedCards = useMemo(() => {
        // Apply filters
        const filtered = initialCards.filter((card) => {
            if (filters.search && !card.n.toLowerCase().includes(filters.search.toLowerCase())) {
                return false;
            }
            if (filters.rarity && card.rarity !== filters.rarity) {
                return false;
            }
            if (filters.type && !card.types.includes(filters.type)) {
                return false;
            }
            if (filters.subtype && !card.subtypes.includes(filters.subtype)) {
                return false;
            }
            if (filters.artist && card.artist !== filters.artist) {
                return false;
            }
            if (filters.weakness && !card.weaknesses.some((w) => w.type === filters.weakness)) {
                return false;
            }
            if (
                filters.resistance &&
                !card.resistances.some((r) => r.type === filters.resistance)
            ) {
                return false;
            }
            return true;
        });

        const sortBy = (filters.sortBy || 'acquired') as SortableKey;
        const sortOrder = filters.sortOrder || 'desc';

        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'price':
                    return (a.price || 0) - (b.price || 0);
                case 'cost':
                    return (a.collectionStats?.cost || 0) - (b.collectionStats?.cost || 0);
                case 'acquired':
                    return (
                        new Date(a.collectionStats?.acquiredAt || 0).getTime() -
                        new Date(b.collectionStats?.acquiredAt || 0).getTime()
                    );
                case 'gain':
                    const gainA = (a.price || 0) - (a.collectionStats?.cost || 0);
                    const gainB = (b.price || 0) - (b.collectionStats?.cost || 0);
                    return gainA - gainB;
                case 'n':
                    return a.n.localeCompare(b.n);
                case 'num':
                    return a.num.localeCompare(b.num, undefined, { numeric: true });
                default:
                    return 0;
            }
        });

        if (sortOrder === 'desc') {
            filtered.reverse();
        }

        return filtered;
    }, [initialCards, filters]);

    return { filteredAndSortedCards };
}

export function CollectionPageView({ cards }: CollectionPageViewProps) {
    const { replaceFilters } = useSearchStore();

    // Reset filters when entering dashboard
    useEffect(() => {
        replaceFilters({ sortBy: 'price', sortOrder: 'desc' });
        return () => replaceFilters({});
    }, [replaceFilters]);

    const { filteredAndSortedCards } = useCollectionFilters(cards);

    // Dynamic filter options for cards we own
    const filterOptions: FilterOptions = useMemo(() => {
        const artists = new Set<string>();
        const rarities = new Set<string>();
        const types = new Set<string>();
        const subtypes = new Set<string>();
        const weaknesses = new Set<string>();
        const resistances = new Set<string>();
        const setsMap = new Map<string, SetObject>();

        cards.forEach((c) => {
            if (c.artist) artists.add(c.artist);
            if (c.rarity) rarities.add(c.rarity);
            c.types?.forEach((t) => types.add(t));
            c.subtypes?.forEach((s) => subtypes.add(s));
            c.weaknesses?.forEach((w) => weaknesses.add(w.type));
            c.resistances?.forEach((r) => resistances.add(r.type));
            if (c.set) setsMap.set(c.set.id, c.set);
        });

        return {
            artists: Array.from(artists).sort(),
            rarities: Array.from(rarities).sort(),
            types: Array.from(types).sort(),
            subtypes: Array.from(subtypes).sort(),
            weaknesses: Array.from(weaknesses).sort(),
            resistances: Array.from(resistances).sort(),
            // Sort sets by release date (newest first)
            sets: Array.from(setsMap.values()).sort(
                (a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
            )
        };
    }, [cards]);

    const sortOptions: { label: string; value: SortableKey }[] = [
        { label: 'Date Acquired', value: 'acquired' },
        { label: 'Market Value', value: 'price' },
        { label: 'Purchase Price', value: 'cost' },
        { label: 'Total Gain', value: 'gain' },
        { label: 'Name', value: 'n' }
    ];

    return (
        <div className='mb-12 flex flex-col gap-6'>
            <div className='rounded-xl border border-border bg-background text-card-foreground shadow-sm'>
                <div className='border-b border-border p-6'>
                    <CardFilterControls filterOptions={filterOptions} sortOptions={sortOptions} />
                </div>

                <div className='min-h-[500px] bg-muted/10 p-6'>
                    <div className='mb-4 flex items-center justify-between'>
                        <p className='text-sm font-medium text-muted-foreground'>
                            Showing {filteredAndSortedCards.length} cards
                        </p>
                    </div>

                    <SimpleCardGrid cards={filteredAndSortedCards} />
                </div>
            </div>
        </div>
    );
}
