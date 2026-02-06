'use client';
import { useSearchStore } from '@/src/lib/store/searchStore';
import { NormalizedCard } from '@/src/shared-types/card-index';
import { useMemo, useEffect } from 'react';
import { SortableKey } from '../src/services/pokemonCardValidator';
import { useCardStore } from '@/src/lib/store/cardStore';
import { useShallow } from 'zustand/react/shallow';
import Fuse from 'fuse.js';

interface UseCardFiltersProps {
    defaultSort?: {
        sortBy: SortableKey;
        sortOrder: 'asc' | 'desc';
    };
}

// Fuse options: create new instance on each filter selection to increase search query speeds
const fuseOptions = {
    keys: [
        { name: 'n', weight: 0.7 },
        { name: 'id', weight: 0.3 }
    ],
    useExtendedSearch: true,
    minMatchCharLength: 1,
    threshold: 0.3,
    ignoreLocation: true
};

function intersectSets(setA: Set<string>, setB: Set<string>): Set<string> {
    const intersection = new Set<string>();
    const [smaller, larger] = setA.size < setB.size ? [setA, setB] : [setB, setA];

    for (const elem of smaller) {
        if (larger.has(elem)) intersection.add(elem);
    }
    return intersection;
}

export function useCardFilters({ defaultSort }: UseCardFiltersProps) {
    const { filters, setFilters } = useSearchStore(
        useShallow((state) => ({
            filters: state.filters,
            setFilters: state.setFilters
        }))
    );

    const {
        cardMap,
        rarityIndex,
        setIndex,
        typeIndex,
        subtypeIndex,
        artistIndex,
        weaknessIndex,
        resistanceIndex,
        globalFuseInstance
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
            globalFuseInstance: state.fuseInstance
        }))
    );

    useEffect(() => {
        if (!filters.sortBy && defaultSort) {
            setFilters(defaultSort);
        }
    }, [filters.sortBy, defaultSort, setFilters]);

    // Efficient Set Intersection
    const candidateCards = useMemo(() => {
        if (!cardMap.size) return [];
        //const startTime = performance.now();

        const activeFilterSets: Set<string>[] = [];
        if (filters.rarity) activeFilterSets.push(rarityIndex.get(filters.rarity) || new Set());
        if (filters.setId) activeFilterSets.push(setIndex.get(filters.setId) || new Set());
        if (filters.type) activeFilterSets.push(typeIndex.get(filters.type) || new Set());
        if (filters.subtype) activeFilterSets.push(subtypeIndex.get(filters.subtype) || new Set());
        if (filters.artist) activeFilterSets.push(artistIndex.get(filters.artist) || new Set());
        if (filters.weakness)
            activeFilterSets.push(weaknessIndex.get(filters.weakness) || new Set());
        if (filters.resistance)
            activeFilterSets.push(resistanceIndex.get(filters.resistance) || new Set());

        let results: NormalizedCard[];

        if (activeFilterSets.length === 0) {
            results = Array.from(cardMap.values());
        } else {
            // Check smaller set against largest set for fewer comparisons
            activeFilterSets.sort((a, b) => a.size - b.size);
            let candidateSet = activeFilterSets[0];
            for (let i = 1; i < activeFilterSets.length; i++) {
                candidateSet = intersectSets(candidateSet, activeFilterSets[i]);
            }

            results = [];
            for (const id of candidateSet) {
                const card = cardMap.get(id);
                if (card) results.push(card);
            }
        }

        // const endTime = performance.now();
        // console.log(`[CandidateCards] Count: ${results.length} | Time: ${(endTime - startTime).toFixed(2)}ms`);
        return results;
    }, [
        cardMap,
        filters.rarity,
        filters.setId,
        filters.type,
        filters.subtype,
        filters.artist,
        filters.weakness,
        filters.resistance,
        rarityIndex,
        setIndex,
        typeIndex,
        subtypeIndex,
        artistIndex,
        weaknessIndex,
        resistanceIndex
    ]);

    // Fuse Instance Selection
    const searchFuse = useMemo(() => {
        if (candidateCards.length === cardMap.size && globalFuseInstance) {
            // console.log('[SearchFuse] Using Global Fuse Instance');
            return globalFuseInstance;
        }

        if (candidateCards.length === 0) return null;

        //const startTime = performance.now();
        const fuse = new Fuse(candidateCards, fuseOptions);
        //const endTime = performance.now();
        //console.log(`[SearchFuse] Built Local Fuse (${candidateCards.length} items) | Time: ${(endTime - startTime).toFixed(2)}ms`);

        return fuse;
    }, [candidateCards, cardMap.size, globalFuseInstance]);

    const filteredCards = useMemo(() => {
        //const startTime = performance.now();
        if (!cardMap.size) return [];

        if (filters.search && searchFuse) {
            let searchTerm = filters.search;
            const idRegex = /^[a-z0-9]+(-[a-zA-Z0-9]+)$/i;
            if (idRegex.test(searchTerm)) searchTerm = `=${searchTerm}`;

            const searchResults = searchFuse.search(searchTerm);
            const results = searchResults.map((r) => r.item);

            // const endTime = performance.now();
            // console.log(`[Filter] Search "${filters.search}" | Time: ${(endTime - startTime).toFixed(2)}ms`);
            return results;
        }

        return candidateCards;
    }, [filters.search, searchFuse, candidateCards, cardMap.size]);

    return { filteredCards };
}
