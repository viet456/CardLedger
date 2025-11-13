import { create } from 'zustand';
import { z } from 'zod';
import { findCardsInputSchema, SortableKey } from '@/src/services/pokemonCardValidator';

// generate a filter-state type from Zod schema
export type FilterState = z.infer<typeof findCardsInputSchema>;

interface SearchStore {
    filters: FilterState;
    previousSortBy: SortableKey | 'relevance' | null;
    setFilters: (newFilters: Partial<FilterState>) => void;
    replaceFilters: (newFilters: FilterState) => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
    filters: {},
    previousSortBy: null,
    setFilters: (newFilters) =>
        set((state) => {
            const newState = { ...state.filters, ...newFilters };
            let newPreviousSortBy = state.previousSortBy;
            if (newFilters.hasOwnProperty('search')) {
                // Set sorting to 'relevance' on search term
                if (newFilters.search && !state.filters.search) {
                    // Save the current sort
                    newPreviousSortBy = state.filters.sortBy || null;
                    newState.sortBy = 'relevance' as SortableKey;
                }
                // Default sorting to release date
                if (!newFilters.search && state.filters.search) {
                    // Restore sort
                    newState.sortBy = state.previousSortBy || ('rD' as SortableKey);
                    // Clear the saved sort
                    newPreviousSortBy = null;
                }
            }

            return { filters: newState, previousSortBy: newPreviousSortBy };
        }),
    replaceFilters: (newFilters) =>
        set(() => ({
            filters: newFilters,
            previousSortBy: null
        }))
}));
