import { useCardStore } from '@/src/lib/store/cardStore';
import { useEffect, useState } from 'react';

export function useHasHydrated() {
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        // A function to subscribe to the hydration event
        const unsubHydrate = useCardStore.persist.onHydrate(() => setIsHydrated(false));
        // A function to subscribe to the finish hydration event
        const unsubFinishHydration = useCardStore.persist.onFinishHydration(() =>
            setIsHydrated(true)
        );

        setIsHydrated(useCardStore.persist.hasHydrated());

        return () => {
            unsubHydrate();
            unsubFinishHydration();
        };
    }, []);

    return isHydrated;
}
