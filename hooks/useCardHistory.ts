'use client';

import { useEffect, useMemo } from 'react';
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
    }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Shared hook for loading card price history (full array for charts).
 * Reads from the zustand store reactively. The store's LRU cache limits
 * decompressed data to ~10 cards at a time before evicting oldest entries.
 */
export function useCardHistory(cardId: string): {
    data: PriceHistoryDataPoint[] | null;
    loading: boolean;
} {
    useEnsureHistoryStoreReady();

    const status = useHistoryStore((s) => s.status);

    const data = useMemo(() => {
        if (!status.startsWith('ready')) return null;
        return useHistoryStore.getState().getAllHistory(cardId);
    }, [status, cardId]);

    const loading = status === 'idle' || status === 'loading';

    return { data, loading };
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

    const data = useMemo(() => {
        if (!status.startsWith('ready')) return null;
        return useHistoryStore.getState().getLatestPrices(cardId);
    }, [status, cardId]);

    const trend = useMemo(() => computePrice(data), [data]);
    const loading = status === 'idle' || status === 'loading';

    return { data, trend, loading };
}

