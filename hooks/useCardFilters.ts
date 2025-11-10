'use client';
import { useSearchStore, FilterState } from '@/src/lib/store/searchStore';
import { DenormalizedCard } from '@/src/shared-types/card-index';
import { useMemo, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SortableKey } from '../src/services/pokemonCardValidator';

interface UseCardFiltersProps {
    initialCards: DenormalizedCard[];
    defaultSort?: {
        sortBy: SortableKey;
        sortOrder: 'asc' | 'desc';
    };
}

export function useCardFilters({ initialCards, defaultSort }: UseCardFiltersProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { filters, setFilters, replaceFilters } = useSearchStore();
    const isInitialMount = useRef(true);

    // Sync URL to search store on intial mount
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        const urlFilters: { [key: string]: string } = {};
        for (const [key, value] of params.entries()) {
            urlFilters[key] = value;
        }
        replaceFilters(urlFilters as Partial<FilterState>);
    }, []);

    // Sync store to URL on change
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                params.set(key, String(value));
            }
        });
        router.replace(`${pathname}?${params.toString()}`);
    }, [filters, pathname, router]);

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
            if (
                filters.weaknessType &&
                !card.weaknesses.some((w) => w.type === filters.weaknessType)
            ) {
                return false;
            }
            if (
                filters.resistanceType &&
                !card.resistances.some((r) => r.type === filters.resistanceType)
            ) {
                return false;
            }
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
                    case 'num':
                        return a.num.localeCompare(b.num, undefined, { numeric: true });
                    case 'price':
                        const priceA = a.price;
                        const priceB = b.price;
                        // Push cards of null and undefined price to the bottom
                        const isAInvalid = priceA === null || priceA === undefined;
                        const isBInvalid = priceB === null || priceB === undefined;
                        if (isAInvalid && isBInvalid) return 0;
                        if (isAInvalid) return 1;
                        if (isBInvalid) return -1;

                        if (sortOrder === 'desc') {
                            return (priceB as number) - (priceA as number);
                        } else {
                            return (priceA as number) - (priceB as number);
                        }
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
                        return a.num.localeCompare(b.num, undefined, { numeric: true });
                }
            });
            if (sortOrder === 'desc' && sortBy !== 'price') {
                results.reverse();
            }
        }
        return results;
    }, [initialCards, filters]);

    return { filteredCards };
}
