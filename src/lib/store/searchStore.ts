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

const DEFAULT_SORT_BY = 'rD' as SortableKey;
const DEFAULT_SORT_ORDER = 'desc' as const;

export const useSearchStore = create<SearchStore>((set) => ({
    filters: {
        sortBy: DEFAULT_SORT_BY,
        sortOrder: DEFAULT_SORT_ORDER
    },
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
                if (!newFilters.search && state.filters.search) {
                    newState.sortBy = state.previousSortBy || DEFAULT_SORT_BY;
                    newPreviousSortBy = null;
                }
            }

            return { filters: newState, previousSortBy: newPreviousSortBy };
        }),
    replaceFilters: (newFilters) =>
        set(() => ({
            filters: {
                // Apply defaults for missing values
                sortBy: newFilters.sortBy || DEFAULT_SORT_BY,
                sortOrder: newFilters.sortOrder || DEFAULT_SORT_ORDER,
                ...newFilters
            },
            previousSortBy: null
        }))
}));
