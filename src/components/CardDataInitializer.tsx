'use client';

import { useCardStore } from '../lib/store/cardStore';
import { useHasHydrated } from '../hooks/useHasHydrated';
import { useEffect } from 'react';
import { useMarketStore } from '../lib/store/marketStore';

export function CardDataInitializer() {
    // Set Zustand memory
    const initializeCards = useCardStore((state) => state.initialize);
    const initializeMarket = useMarketStore((state) => state.initialize);
    const isHydrated = useHasHydrated();
    // Only call initialize() AFTER the store has loaded from IndexedDB
    useEffect(() => {
        if (isHydrated) {
            initializeCards();
            initializeMarket();
        }
    }, [isHydrated, initializeCards, initializeMarket]);
    return null;
}
