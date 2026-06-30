'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useHistoryStore, getCachedHistory } from '@/src/lib/store/historyStore';
import { PriceHistoryDataPoint } from '@/src/shared-types/price-api';

/**
 * Ensure the history store is initialized. No-op if already loading or ready.
 */
function useEnsureHistoryStoreReady() {
    const status = useHistoryStore((s) => s.status);

    useEffect(() => {
        if (status === 'idle') {
            useHistoryStore.getState().initialize();
        }
    }, [status]);
}

export interface PriceTrend {
    price: number;
    diff: number;
    percent: number;
}

function computePrice(data: PriceHistoryDataPoint[] | null): PriceTrend {
    if (!data || data.length === 0) {
        return { price: 0, diff: 0, percent: 0 };
    }

    const latest = data[data.length - 1];
    const price = latest.tcgNearMint || latest.tcgNormal || latest.tcgHolo || latest.tcgReverse || latest.tcgFirstEdition || 0;

    const previous = data[data.length - 2];
    const prevPrice = previous?.tcgNearMint || previous?.tcgNormal || previous?.tcgHolo || price;
    const diff = price - prevPrice;
    const percent = prevPrice !== 0 ? (diff / prevPrice) * 100 : 0;

    return { price, diff, percent };
}

/**
 * Shared hook for loading card price history (full array for charts).
 * Reads per-card data from IndexedDB asynchronously. The store's LRU cache limits
 * decompressed data to ~10 cards at a time before evicting oldest entries.
 */
export function useCardHistory(cardId: string): {
    data: PriceHistoryDataPoint[] | null;
    loading: boolean;
} {
    useEnsureHistoryStoreReady();

    // Subscribe to index availability — this is set from zustand persist hydration (fast IDB read),
    // NOT from initialize() which fetches a pointer file from R2 (~1s delay).
    // This lets us read per-card data from IDB as soon as the index is hydrated.
    const index = useHistoryStore((s) => s.index);
    const [fetched, setFetched] = useState<{ cardId: string; data: PriceHistoryDataPoint[] | null; resolved: boolean }>(() => {
        const cached = getCachedHistory(cardId);
        if (cached !== undefined) {
            return { cardId, data: cached, resolved: true };
        }
        return { cardId, data: null, resolved: false };
    });
    const cardIdRef = useRef(cardId);

    useEffect(() => {
        cardIdRef.current = cardId;
    }, [cardId]);

    useEffect(() => {
        // Gate on index availability (from persist hydration), not store status.
        // The index contains dates[] needed to decode per-card IDB entries.
        if (!index) return;

        // If already resolved from LRU cache for this cardId, skip the IDB read
        if (fetched.cardId === cardId && fetched.resolved) return;

        let cancelled = false;
        useHistoryStore.getState().getAllHistory(cardId).then((result) => {
            if (!cancelled && cardIdRef.current === cardId) {
                setFetched({ cardId, data: result, resolved: true });
            }
        });

        return () => { cancelled = true; };
    }, [index, cardId]);

    // If fetched data is for a different cardId, treat as null (stale)
    const isStale = fetched.cardId !== cardId;
    const data = isStale ? null : fetched.data;
    const resolved = isStale ? false : fetched.resolved;
    // Only loading if the data hasn't resolved yet (LRU cache or IDB read).
    // Don't gate on store status — LRU-cached data is valid immediately.
    const loading = !resolved;

    return { data, loading };
}

/**
 * Lightweight hook for PriceHero: returns the computed price and trend
 * (price, diff, percent) from the last ~2 data points, without
 * decompressing the full history array.
 */
export function useCardLatestPrices(cardId: string): {
    data: PriceHistoryDataPoint[] | null;
    trend: PriceTrend;
    loading: boolean;
} {
    useEnsureHistoryStoreReady();

    // Subscribe to index availability — set from zustand persist hydration (fast IDB read).
    const index = useHistoryStore((s) => s.index);
    // Check LRU cache synchronously to avoid skeleton flash on revisit.
    // The LRU cache stores full history arrays, so we can derive latest 2 points.
    const [fetched, setFetched] = useState<{ cardId: string; data: PriceHistoryDataPoint[] | null; resolved: boolean }>(() => {
        const cached = getCachedHistory(cardId);
        if (cached !== undefined) {
            const latestTwo = cached.length > 1 ? cached.slice(-2) : cached.length > 0 ? cached : null;
            return { cardId, data: latestTwo, resolved: true };
        }
        return { cardId, data: null, resolved: false };
    });
    const cardIdRef = useRef(cardId);

    useEffect(() => {
        cardIdRef.current = cardId;
    }, [cardId]);

    useEffect(() => {
        // Gate on index availability (from persist hydration), not store status.
        if (!index) return;

        // If already resolved from LRU cache for this cardId, skip the IDB read
        if (fetched.cardId === cardId && fetched.resolved) return;

        let cancelled = false;
        useHistoryStore.getState().getLatestPrices(cardId).then((result) => {
            if (!cancelled && cardIdRef.current === cardId) {
                setFetched({ cardId, data: result, resolved: true });
            }
        });

        return () => { cancelled = true; };
    }, [index, cardId]);

    const isStale = fetched.cardId !== cardId;
    const data = isStale ? null : fetched.data;
    const resolved = isStale ? false : fetched.resolved;
    const trend = useMemo(() => computePrice(data), [data]);
    // Only loading if the data hasn't resolved yet (LRU cache or IDB read).
    // Don't gate on store status — LRU-cached data is valid immediately.
    const loading = !resolved;

    return { data, trend, loading };
}
