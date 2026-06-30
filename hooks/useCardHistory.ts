'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useHistoryStore } from '@/src/lib/store/historyStore';
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

    const status = useHistoryStore((s) => s.status);
    // Track which cardId the fetched data belongs to, so stale data from a previous card
    // is naturally masked in render without a synchronous setState in an effect.
    const [fetched, setFetched] = useState<{ cardId: string; data: PriceHistoryDataPoint[] | null; resolved: boolean }>({
        cardId,
        data: null,
        resolved: false
    });
    const cardIdRef = useRef(cardId);

    useEffect(() => {
        cardIdRef.current = cardId;
    }, [cardId]);

    useEffect(() => {
        if (!status.startsWith('ready')) return;

        let cancelled = false;
        useHistoryStore.getState().getAllHistory(cardId).then((result) => {
            if (!cancelled && cardIdRef.current === cardId) {
                setFetched({ cardId, data: result, resolved: true });
            }
        });

        return () => { cancelled = true; };
    }, [status, cardId]);

    // If fetched data is for a different cardId, treat as null (stale)
    const isStale = fetched.cardId !== cardId;
    const data = isStale ? null : fetched.data;
    const resolved = isStale ? false : fetched.resolved;
    // Only loading if the store isn't ready OR the IDB read hasn't resolved yet
    const loading = status === 'idle' || status === 'loading' || (status.startsWith('ready') && !resolved);

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

    const status = useHistoryStore((s) => s.status);
    const [fetched, setFetched] = useState<{ cardId: string; data: PriceHistoryDataPoint[] | null; resolved: boolean }>({
        cardId,
        data: null,
        resolved: false
    });
    const cardIdRef = useRef(cardId);

    useEffect(() => {
        cardIdRef.current = cardId;
    }, [cardId]);

    useEffect(() => {
        if (!status.startsWith('ready')) return;

        let cancelled = false;
        useHistoryStore.getState().getLatestPrices(cardId).then((result) => {
            if (!cancelled && cardIdRef.current === cardId) {
                setFetched({ cardId, data: result, resolved: true });
            }
        });

        return () => { cancelled = true; };
    }, [status, cardId]);

    const isStale = fetched.cardId !== cardId;
    const data = isStale ? null : fetched.data;
    const resolved = isStale ? false : fetched.resolved;
    const trend = useMemo(() => computePrice(data), [data]);
    // Only loading if the store isn't ready OR the IDB read hasn't resolved yet
    const loading = status === 'idle' || status === 'loading' || (status.startsWith('ready') && !resolved);

    return { data, trend, loading };
}
