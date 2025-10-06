'use client';

import { useCardStore } from '../lib/store/cardStore';
import { useHasHydrated } from '../hooks/useHasHydrated';
import { useEffect } from 'react';

export function CardDataInitializer() {
    const initialize = useCardStore((state) => state.initialize);
    const isHydrated = useHasHydrated();
    // Only call initialize() AFTER the store has loaded from IndexedDB
    useEffect(() => {
        if (isHydrated) {
            initialize();
        }
    }, [isHydrated, initialize]);
    return null;
}
