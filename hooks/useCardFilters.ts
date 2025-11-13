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
        sets, // We need this for sorting
        fuseInstance
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
            sets: state.sets,
            fuseInstance: state.fuseInstance
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

        // If search-term, sort by relevance
        if (filters.search && fuseInstance) {
            // id searching on cards/sets
            let searchTerm = filters.search;
            const idRegex = /^[a-z0-9]+(-[a-zA-Z0-9]+)$/i;
            if (idRegex.test(searchTerm)) {
                searchTerm = `=${searchTerm}`;
            }
            const searchResults = fuseInstance.search(searchTerm);
            const relevantAndFiltered: NormalizedCard[] = [];

            const raritySet = filters.rarity ? rarityIndex.get(filters.rarity) : null;
            const setSet = filters.setId ? setIndex.get(filters.setId) : null;
            const typeSet = filters.type ? typeIndex.get(filters.type) : null;
            const subtypeSet = filters.subtype ? typeIndex.get(filters.subtype) : null;
            const artistSet = filters.artist ? typeIndex.get(filters.artist) : null;
            const weaknessSet = filters.weaknessType
                ? weaknessIndex.get(filters.weaknessType)
                : null;
            const resistanceSet = filters.resistanceType
                ? resistanceIndex.get(filters.resistanceType)
                : null;

            for (const result of searchResults) {
                const card = result.item;
                if (raritySet && !raritySet.has(card.id)) continue;
                if (setSet && !setSet.has(card.id)) continue;
                if (typeSet && !typeSet.has(card.id)) continue;
                if (subtypeSet && !subtypeSet.has(card.id)) continue;
                if (artistSet && !artistSet.has(card.id)) continue;
                if (weaknessSet && !weaknessSet.has(card.id)) continue;
                if (resistanceSet && !resistanceSet.has(card.id)) continue;

                relevantAndFiltered.push(card);
            }
            return relevantAndFiltered;
        } else {
            baseSet = new Set<string>(cardMap.keys());

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
                baseSet = intersectSets(
                    baseSet,
                    weaknessIndex.get(filters.weaknessType) || new Set()
                );
            }
            if (filters.resistanceType) {
                baseSet = intersectSets(
                    baseSet,
                    resistanceIndex.get(filters.resistanceType) || new Set()
                );
            }

            const results: NormalizedCard[] = [];
            for (const id of baseSet) {
                results.push(cardMap.get(id)!);
            }
            return results;
        }
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
        sets,
        fuseInstance
    ]);

    return { filteredCards };
}
