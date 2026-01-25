import { useCardStore } from '@/src/lib/store/cardStore';
import { useShallow } from 'zustand/react/shallow';
import { useMemo } from 'react';

export interface SearchSuggestion {
    id: string;
    name: string;
    number: string;
    set: {
        name: string;
        printedTotal: number;
    };
}

export function useLocalSearch(query: string) {
    const { fuseInstance, sets } = useCardStore(
        useShallow((state) => ({
            fuseInstance: state.fuseInstance,
            sets: state.sets
        }))
    );

    const suggestions = useMemo(() => {
        if (!query || query.length === 0 || !fuseInstance || sets.length === 0) {
            return [];
        }

        const results = fuseInstance.search(query, { limit: 5 });

        return results.map((result) => {
            const card = result.item;
            const setInfo = sets[card.s];

            return {
                id: card.id,
                name: card.n,
                number: card.num,
                set: {
                    name: setInfo ? setInfo.name : 'Unknown Set',
                    printedTotal: setInfo ? setInfo.printedTotal : 0
                }
            };
        });
    }, [query, fuseInstance, sets]);

    return {
        suggestions,
        isReady: !!fuseInstance && sets.length > 0
    };
}
