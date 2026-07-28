'use client';

import { useMemo } from 'react';
import { useCollectionStore } from '@/src/lib/store/collectionStore';
import { useCardStore } from '@/src/lib/store/cardStore';

/**
 * Lightweight hook for rendering a basic progress bar on SetCards.
 * Only computes unique card count — no variant/rarity/artist breakdowns.
 */
export function useSetProgress(setId: string): { owned: number; total: number; isLoading: boolean } {
    const collectionStatus = useCollectionStore((s) => s.status);
    const entries = useCollectionStore((s) => s.entries);
    const setIndex = useCardStore((s) => s.setIndex);

    const setCardIds = useMemo(() => setIndex.get(setId), [setId, setIndex]);

    const total = setCardIds?.size ?? 0;

    const owned = useMemo(() => {
        if (!setCardIds || total === 0) return 0;
        const ownedSet = new Set<string>();
        for (const entry of entries) {
            if (setCardIds.has(entry.cardId)) {
                ownedSet.add(entry.cardId);
            }
        }
        return ownedSet.size;
    }, [entries, setCardIds, total]);

    // isLoading only when actively fetching (not 'idle' which means signed-out or not yet initialized)
    const isLoading = collectionStatus === 'loading';

    return {
        owned,
        total,
        isLoading,
    };
}