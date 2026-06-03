'use client';

import { useCardStore } from '../lib/store/cardStore';
import { useHasHydrated } from '../../hooks/useHasHydrated';
import { useEffect } from 'react';
import { useMarketStore } from '../lib/store/marketStore';
import { useHistoryStore } from '../lib/store/historyStore';

export function CardDataInitializer() {
    // Set Zustand memory
    const initializeCards = useCardStore((state) => state.initialize);
    const initializeMarket = useMarketStore((state) => state.initialize);
    const initializeHistory = useHistoryStore((state) => state.initialize);
    const isHydrated = useHasHydrated();
    // Only call initialize() AFTER the store has loaded from IndexedDB
    useEffect(() => {
        if (isHydrated) {
            initializeCards();
            initializeMarket();
            initializeHistory();
        }
    }, [isHydrated, initializeCards, initializeMarket, initializeHistory]);
    return null;
}
