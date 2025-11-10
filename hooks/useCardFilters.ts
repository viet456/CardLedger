'use client';
import { useSearchStore, FilterState } from '@/src/lib/store/searchStore';
import { NormalizedCard } from '@/src/shared-types/card-index';
import { useMemo, useEffect, useRef } from 'react';
import { SortableKey } from '../src/services/pokemonCardValidator';
import { useCardStore } from '@/src/lib/store/cardStore';
import { useShallow } from 'zustand/react/shallow';

interface UseCardFiltersProps {
    defaultSort?: {
        sortBy: SortableKey;
        sortOrder: 'asc' | 'desc';
    };
}

function intersectSets(setA: Set<string>, setB: Set<string>): Set<string> {
    const intersection = new Set<string>();
    if (setA.size < setB.size) {
        for (const elem of setA) {
            if (setB.has(elem)) {
                intersection.add(elem);
            }
        }
    } else {
        for (const elem of setB) {
            if (setA.has(elem)) {
                intersection.add(elem);
            }
        }
    }
    return intersection;
}

export function useCardFilters({ defaultSort }: UseCardFiltersProps) {
    const { filters, setFilters, replaceFilters } = useSearchStore(
        useShallow((state) => ({
            filters: state.filters,
            setFilters: state.setFilters,
            replaceFilters: state.replaceFilters
        }))
    );

    // Filter indexes from cardStore
    const {
        cardMap,
        rarityIndex,
        setIndex,
        typeIndex,
        subtypeIndex,
        artistIndex,
        weaknessIndex,
        resistanceIndex,
        sets // We need this for sorting
    } = useCardStore(
        useShallow((state) => ({
            cardMap: state.cardMap,
            rarityIndex: state.rarityIndex,
            setIndex: state.setIndex,
            typeIndex: state.typeIndex,
            subtypeIndex: state.subtypeIndex,
            artistIndex: state.artistIndex,
            weaknessIndex: state.weaknessIndex,
            resistanceIndex: state.resistanceIndex,
            sets: state.sets
        }))
    );

    useEffect(() => {
        if (!filters.sortBy && defaultSort) {
            setFilters(defaultSort);
        }
    }, [filters.sortBy, defaultSort, setFilters]);

    const filteredCards = useMemo(() => {
        if (!cardMap.size || !sets.length) return [];
        // filtering
        let baseSet = new Set<string>(cardMap.keys());

        if (filters.rarity) {
            baseSet = intersectSets(baseSet, rarityIndex.get(filters.rarity) || new Set());
        }
        if (filters.setId) {
            baseSet = intersectSets(baseSet, setIndex.get(filters.setId) || new Set());
        }
        if (filters.type) {
            baseSet = intersectSets(baseSet, typeIndex.get(filters.type) || new Set());
        }
        if (filters.subtype) {
            baseSet = intersectSets(baseSet, subtypeIndex.get(filters.subtype) || new Set());
        }
        if (filters.artist) {
            baseSet = intersectSets(baseSet, artistIndex.get(filters.artist) || new Set());
        }
        if (filters.weaknessType) {
            baseSet = intersectSets(baseSet, weaknessIndex.get(filters.weaknessType) || new Set());
        }
        if (filters.resistanceType) {
            baseSet = intersectSets(
                baseSet,
                resistanceIndex.get(filters.resistanceType) || new Set()
            );
        }

        const searchFilter = filters.search?.toLowerCase();
        if (searchFilter) {
            const searchResults = new Set<string>();
            for (const cardId of baseSet) {
                const card = cardMap.get(cardId)!;
                if (card.n.toLowerCase().includes(searchFilter)) {
                    searchResults.add(cardId);
                }
            }
            baseSet = searchResults;
        }

        const results: NormalizedCard[] = [];
        for (const id of baseSet) {
            results.push(cardMap.get(id)!);
        }

        // Default sorting
        const sortBy = (filters.sortBy || 'rD') as SortableKey;
        const sortOrder = filters.sortOrder || 'desc';

        if (sortBy === 'rD' && sortOrder === 'desc') {
            const setReleaseDateMap = new Map<number, number>(
                sets.map((set, i) => [i, new Date(set.releaseDate).getTime()])
            );
            results.sort((a, b) => {
                const dateA = setReleaseDateMap.get(a.s)!;
                const dateB = setReleaseDateMap.get(b.s)!;
                if (dateA !== dateB) return dateB - dateA;
                return a.num.localeCompare(b.num, undefined, { numeric: true });
            });
        }
        return results;
    }, [
        filters,
        cardMap,
        rarityIndex,
        setIndex,
        typeIndex,
        subtypeIndex,
        artistIndex,
        weaknessIndex,
        resistanceIndex,
        sets
    ]);

    return { filteredCards };
}
