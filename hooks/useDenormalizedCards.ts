'use client';

import { useMemo } from 'react';
import { NormalizedCard } from '@/src/shared-types/card-index';
import { useCardStore } from '@/src/lib/store/cardStore';
import { useMarketStore } from '@/src/lib/store/marketStore';
import { denormalizeAndSortCards } from '@/src/utils/cardUtils';
import { useShallow } from 'zustand/react/shallow';
import { FilterState } from '@/src/services/pokemonCardValidator';

// Combines cards store with prices store

export function useDenormalizedCards(normalizedCards: NormalizedCard[], filters: FilterState) {
    const lookups = useCardStore(
        useShallow((state) => ({
            rarities: state.rarities,
            sets: state.sets,
            types: state.types,
            subtypes: state.subtypes,
            artists: state.artists,
            supertypes: state.supertypes,
            abilities: state.abilities,
            attacks: state.attacks,
            rules: state.rules
        }))
    );

    const { prices } = useMarketStore();

    // Pass in smaller group of filtered cards, and then denormalize
    // - pass in price data and then we can sort over this small group
    const denormalizedAndSortedCards = useMemo(() => {
        return denormalizeAndSortCards(normalizedCards, lookups, prices, filters);
    }, [normalizedCards, lookups, prices, filters]);

    return { denormalizedAndSortedCards };
}
