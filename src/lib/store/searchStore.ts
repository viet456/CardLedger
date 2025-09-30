import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FindCardsParams } from '@/src/services/pokemonCardService';

interface FilterState {
    filters: FindCardsParams;
    setFilters: (newFilters: Partial<FindCardsParams>) => void;
}

export const useSearchStore = create<FilterState>()(
    persist(
        (set) => ({
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
                unlimited: undefined,
                sortBy: null,
                sortOrder: 'asc'
            },
            setFilters: (newFilters) => {
                console.log('setFilters called with:', newFilters);
                console.log('Stack trace:', new Error().stack);
                set((state) => ({
                    filters: { ...state.filters, ...newFilters }
                }));
            }
        }),
        {
            name: 'card-search-filters' // localStorage key name
        }
    )
);
