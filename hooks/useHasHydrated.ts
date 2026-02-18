import { useCardStore } from '@/src/lib/store/cardStore';
import { useMarketStore } from '@/src/lib/store/marketStore';
import { useSyncExternalStore, useCallback } from 'react';

interface PersistedStore {
    persist: {
        onHydrate: (callback: () => void) => () => void;
        onFinishHydration: (callback: () => void) => () => void;
        hasHydrated: () => boolean;
    };
}

function useStoreHydration(store: PersistedStore): boolean {
    return useSyncExternalStore(
        // Subscribe: React calls this to register a listener
        useCallback(
            (callback) => {
                // Listen for the finish event
                const unsub = store.persist.onFinishHydration(callback);
                return unsub;
            },
            [store]
        ),

        // Get Snapshot: How React checks the current value
        () => store.persist.hasHydrated(),

        // Server Snapshot: For SSR (Next.js), assume not hydrated yet
        () => false
    );
}

export function useHasHydrated() {
    const cardStoreHydrated = useStoreHydration(useCardStore);
    const marketStoreHydrated = useStoreHydration(useMarketStore);

    return cardStoreHydrated && marketStoreHydrated;
}
