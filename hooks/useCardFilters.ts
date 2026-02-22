'use client';
import { useSearchStore } from '@/src/lib/store/searchStore';
import { NormalizedCard } from '@/src/shared-types/card-index';
import { useMemo, useEffect } from 'react';
import { SortableKey } from '../src/services/pokemonCardValidator';
import { useCardStore, IndexedCard } from '@/src/lib/store/cardStore';
import { useShallow } from 'zustand/react/shallow';
import { CardPrices } from '@/src/shared-types/price-api';
import { useMarketStore } from '@/src/lib/store/marketStore';

interface UseCardFiltersProps {
    defaultSort?: {
        sortBy: SortableKey;
        sortOrder: 'asc' | 'desc';
    };
}

// Helper to get price for sorting without full denormalization
function getEffectivePrice(priceData?: CardPrices): number | null {
    if (!priceData) return null;
    return (
        priceData.tcgNearMint ??
        priceData.tcgNormal ??
        priceData.tcgHolo ??
        priceData.tcgReverse ??
        priceData.tcgFirstEdition ??
        null
    );
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
    const prices = useMarketStore((state) => state.prices);

    const {
        cards,
        sets,
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
            sets: state.sets,
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

            const matchedCards: IndexedCard[] = [];

            for (const id of candidateSet) {
                const card = cardMap.get(id);
                if (card) matchedCards.push(card);
            }
            matchedCards.sort((a, b) => a._index - b._index);
            results = matchedCards;
        }

        // const endTime = performance.now();
        // console.log(`[CandidateCards] Count: ${results.length} | Time: ${(endTime - startTime).toFixed(2)}ms`);
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

    // uFuzzy Search Filter
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

        if (candidateCards.length !== cards.length) {
            // Create a Set of allowed IDs for O(1) lookup
            const allowedIds = new Set(candidateCards.map((c) => c.id));
            return searchResults.filter((c) => allowedIds.has(c.id));
        }

        // const endTime = performance.now();
        // console.log(`[uFuzzy Search] Query: "${query}" | Results: ${finalResults.length} | Time: ${(endTime - startTime).toFixed(2)}ms`);

        return searchResults;
    }, [filters.search, ufInstance, searchHaystack, candidateCards, cards]);

    // Sort the normalized cards
    const sortedAndFilteredCards = useMemo(() => {
        const sortBy = (filters.sortBy || (filters.search ? 'relevance' : 'rD')) as SortableKey | 'relevance';
        const sortOrder = filters.sortOrder || 'desc';

        // Fast path 1: Relevance preserves uFuzzy order
        if (sortBy === 'relevance') return filteredCards;

        // Fast path 2: Default backend JSON order, skip sorting entirely.
        if (sortBy === 'rD' && sortOrder === 'desc' && !filters.search) {
            return filteredCards;
        }

        const cardsToSort = [...filteredCards];
        const setReleaseDateMap = new Map<number, number>(
            sets.map((set, index) => [index, new Date(set.releaseDate).getTime()])
        );
        cardsToSort.sort((a, b) => {
            switch (sortBy) {
                case 'price':
                    const priceA = getEffectivePrice(prices[a.id]);
                    const priceB = getEffectivePrice(prices[b.id]);
                    const isAInvalid = priceA === null;
                    const isBInvalid = priceB === null;
                    
                    if (isAInvalid && isBInvalid) return 0;
                    if (isAInvalid) return 1;
                    if (isBInvalid) return -1;
                    return sortOrder === 'desc' ? priceB - priceA : priceA - priceB;

                case 'n':
                    const nameDiff = a.n.localeCompare(b.n);
                    if (nameDiff !== 0) return nameDiff;
                    return setReleaseDateMap.get(a.s)! - setReleaseDateMap.get(b.s)!;
                
                case 'num':
                    return a.num.localeCompare(b.num, undefined, { numeric: true });
                
                case 'pS':
                    const pokedexDiff = (a.pS || 9999) - (b.pS || 9999);
                    if (pokedexDiff !== 0) return pokedexDiff;
                    return setReleaseDateMap.get(a.s)! - setReleaseDateMap.get(b.s)!;
                
                case 'rD':
                default:
                    const dateA = setReleaseDateMap.get(a.s)!;
                    const dateB = setReleaseDateMap.get(b.s)!;
                    
                    if (dateA !== dateB) {
                        return dateA - dateB; 
                    }
                    
                    // Tie-breaker: Set Size (prevents interweaving on ascending sort)
                    if (a.s !== b.s) {
                        return sets[b.s].total - sets[a.s].total;
                    }

                    // Tie-breaker: Card Number
                    return a.num.localeCompare(b.num, undefined, { numeric: true });
            }
        });

        if (sortOrder === 'desc' && sortBy !== 'price' && sortBy !== 'rD') {
            cardsToSort.reverse();
        }
        return cardsToSort;

    }, [filteredCards, filters.sortBy, filters.search, filters.sortOrder, sets, prices]);

    return { filteredCards: sortedAndFilteredCards };
}
