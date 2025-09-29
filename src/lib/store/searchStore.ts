import { create } from 'zustand';
import type { FindCardsParams } from '@/src/services/pokemonCardService';

interface FilterState {
    filters: FindCardsParams;
    setFilters: (newFilters: Partial<FindCardsParams>) => void;
}

export const useSearchStore = create<FilterState>((set) => ({
    filters: {
        cursor: null,
        search: '',
        setId: '',
        releaseDate: undefined,
        supertype: undefined,
        rarity: '',
        number: '',
        hp_gte: undefined,
        hp_lte: undefined,
        artist: '',
        convertedRetreatCost_gte: undefined,
        convertedRetreatCost_lte: undefined,
        pokedexNumberSort: undefined,
        type: '',
        subtype: '',
        weaknessType: '',
        resistanceType: '',
        ability: '',
        rules: '',
        standard: undefined,
        expanded: undefined,
        unlimited: undefined
    },

    setFilters: (newFilters) =>
        set((state) => ({
            filters: { ...state.filters, ...newFilters }
        }))
}));
