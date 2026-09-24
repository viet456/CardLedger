import { create } from 'zustand';
import { z } from 'zod';
import { findCardsInputSchema, SortableKey } from '@/src/services/pokemonCardValidator';

export type FilterState = z.infer<typeof findCardsInputSchema>;

interface SearchStore {
    filters: FilterState;
    previousSortBy: SortableKey | 'relevance' | null;
    setFilters: (newFilters: Partial<FilterState>) => void;
    replaceFilters: (newFilters: FilterState) => void;
}

// Locked sort contract (see src/utils/cardSort.ts): sortBy/sortOrder never
// persist in the store — URL query params are the sole sort authority. The
// store starts empty and page entry effects replace it from the URL.

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
                    newPreviousSortBy = state.filters.sortBy || null;
                    newState.sortBy = 'relevance' as SortableKey;
                }
                // Restore previous sort when clearing search
                // (undefined -> page default applies; see cardSort.ts)
                if (!newFilters.search && state.filters.search) {
                    newState.sortBy = state.previousSortBy || undefined;
                    newPreviousSortBy = null;
                }
            }

            return { filters: newState, previousSortBy: newPreviousSortBy };
        }),
    replaceFilters: (newFilters) =>
        set(() => ({
            // Full replace with verbatim URL-derived values — missing sort keys
            // stay undefined (page defaults apply). No defaults are injected.
            filters: newFilters,
            previousSortBy: null
        }))
}));
