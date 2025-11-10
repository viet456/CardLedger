import { useCardStore } from '@/src/lib/store/cardStore';
import { useMarketStore } from '@/src/lib/store/marketStore';
import { useEffect, useState } from 'react';

interface PersistedStore {
    persist: {
        onHydrate: (callback: () => void) => () => void;
        onFinishHydration: (callback: () => void) => () => void;
        hasHydrated: () => boolean;
    };
}

function useStoreHydration(store: PersistedStore): boolean {
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        // A function to subscribe to the hydration event
        const unsubHydrate = store.persist.onHydrate(() => setIsHydrated(false));
        // A function to subscribe to the finish hydration event
        const unsubFinishHydration = store.persist.onFinishHydration(() => setIsHydrated(true));

        setIsHydrated(store.persist.hasHydrated());

        return () => {
            unsubHydrate();
            unsubFinishHydration();
        };
    }, [store]);

    return isHydrated;
}

export function useHasHydrated() {
    const cardStoreHydrated = useStoreHydration(useCardStore);
    const marketStoreHydrated = useStoreHydration(useMarketStore);

    return cardStoreHydrated && marketStoreHydrated;
}
