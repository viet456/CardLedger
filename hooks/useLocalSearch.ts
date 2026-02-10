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
    const { ufInstance, searchHaystack, cards, sets } = useCardStore(
        useShallow((state) => ({
            ufInstance: state.ufInstance,
            searchHaystack: state.searchHaystack,
            cards: state.cards,
            sets: state.sets
        }))
    );

    const suggestions = useMemo(() => {
        if (!query || query.length === 0 || !ufInstance || searchHaystack.length === 0) {
            return [];
        }

        const [idxs, info, order] = ufInstance.search(searchHaystack, query);
        const topResults: number[] = [];
        if (order && info) {
            for (let i = 0; i < Math.min(5, order.length); i++) {
                topResults.push(info.idx[order[i]]);
            }
        } else if (idxs) {
            for (let i = 0; i < Math.min(5, idxs.length); i++) {
                topResults.push(idxs[i]);
            }
        }

        return topResults.map((cardIndex) => {
            const card = cards[cardIndex];
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
    }, [query, ufInstance, searchHaystack, cards, sets]);

    return {
        suggestions,
        isReady: !!ufInstance && searchHaystack.length > 0
    };
}
