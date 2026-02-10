'use client';
import { useSearchStore } from '@/src/lib/store/searchStore';
import { NormalizedCard } from '@/src/shared-types/card-index';
import { useMemo, useEffect } from 'react';
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
        cards,
        cardMap,
        rarityIndex,
        setIndex,
        typeIndex,
        subtypeIndex,
        artistIndex,
        weaknessIndex,
        resistanceIndex,
        ufInstance,
        searchHaystack
    } = useCardStore(
        useShallow((state) => ({
            cards: state.cards,
            cardMap: state.cardMap,
            rarityIndex: state.rarityIndex,
            setIndex: state.setIndex,
            typeIndex: state.typeIndex,
            subtypeIndex: state.subtypeIndex,
            artistIndex: state.artistIndex,
            weaknessIndex: state.weaknessIndex,
            resistanceIndex: state.resistanceIndex,
            ufInstance: state.ufInstance,
            searchHaystack: state.searchHaystack
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
            results = cards;
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

        //const endTime = performance.now();
        //console.log(`[CandidateCards] Count: ${results.length} | Time: ${(endTime - startTime).toFixed(2)}ms`);
        return results;
    }, [
        cards,
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

    const filteredCards = useMemo(() => {
        if (!filters.search || !ufInstance || !searchHaystack.length) {
            return candidateCards;
        }
        //const startTime = performance.now();
        const query = filters.search;
        const [idxs, info, order] = ufInstance.search(searchHaystack, query);
        let searchResults: NormalizedCard[] = [];

        if (order && info) {
            for (let i = 0; i < order.length; i++) {
                const index = info.idx[order[i]];
                searchResults.push(cards[index]);
            }
        } else if (idxs) {
            // Otherwise just mapped indices
            for (let i = 0; i < idxs.length; i++) {
                searchResults.push(cards[idxs[i]]);
            }
        }

        let finalResults = searchResults;
        if (candidateCards.length !== cards.length) {
            // Create a Set of allowed IDs for O(1) lookup
            const allowedIds = new Set(candidateCards.map(c => c.id));
            finalResults = searchResults.filter(c => allowedIds.has(c.id));
        }

        //const endTime = performance.now();
        //console.log(`[uFuzzy Search] Query: "${query}" | Results: ${finalResults.length} | Time: ${(endTime - startTime).toFixed(2)}ms`);

        return finalResults;
        }, [filters.search, ufInstance, searchHaystack, candidateCards, cards]);

    return { filteredCards };
}
