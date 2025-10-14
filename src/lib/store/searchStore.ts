import { create } from 'zustand';
import { z } from 'zod';
import { findCardsInputSchema } from '@/src/services/pokemonCardValidator';

// generate a filter-state type from Zod schema
export type FilterState = z.infer<typeof findCardsInputSchema>;

interface SearchStore {
    filters: FilterState;
    setFilters: (newFilters: Partial<FilterState>) => void;
    replaceFilters: (newFilters: FilterState) => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
    filters: {},
    setFilters: (newFilters) => set((state) => ({ filters: { ...state.filters, ...newFilters } })),
    replaceFilters: (newFilters) => set({ filters: newFilters })
}));
