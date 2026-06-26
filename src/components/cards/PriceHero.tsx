'use client';

import { useEffect, useState } from 'react';
import { PriceHistoryDataPoint } from '@/src/shared-types/price-api';
import { PriceHeroSkeleton } from '@/src/app/cards/[cardId]/Skeletons';
import { useMarketStore } from '@/src/lib/store/marketStore';

export function PriceHero({ cardId }: { cardId: string }) {
    const [data, setData] = useState<PriceHistoryDataPoint[] | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Attempt to get instant price from market cache
    const cachedPrices = useMarketStore(state => state.prices[cardId]);
    const fallbackPrice = cachedPrices 
        ? (cachedPrices.tcgNearMint || cachedPrices.tcgNormal || cachedPrices.tcgHolo || cachedPrices.tcgReverse || cachedPrices.tcgFirstEdition || 0)
        : 0;

    useEffect(() => {
        let cancelled = false;

        const loadLocalFirst = async () => {
            let localSuccess = false;

            // 1. Try history store for instant local data (includes trend)
            try {
                const { useHistoryStore } = await import('@/src/lib/store/historyStore');
                const store = useHistoryStore.getState();

                // If idle, kick off initialization but also try to wait briefly
                if (store.status === 'idle') {
                    store.initialize();
                }

                let currentStore = useHistoryStore.getState();

                if (currentStore.status === 'loading') {
                    await new Promise<void>((resolve) => {
                        const timeout = setTimeout(() => {
                            unsub();
                            resolve();
                        }, 8000);
                        const unsub = useHistoryStore.subscribe((state) => {
                            if (state.status !== 'loading') {
                                clearTimeout(timeout);
                                unsub();
                                currentStore = state;
                                resolve();
                            }
                        });
                    });
                }

                if (currentStore.status.startsWith('ready')) {
                    const localData = currentStore.getAllHistory(cardId);
                    if (localData && localData.length > 0 && !cancelled) {
                        setData(localData);
                        localSuccess = true;
                    }
                }
            } catch (err) {
                // Silently fall back to network
            }

            // 2. Only use network as fallback if local data wasn't available
            if (!localSuccess && !cancelled) {
                try {
                    const res = await fetch(`/api/prices/${cardId}`);
                    if (res.ok && !cancelled) {
                        const networkData = await res.json();
                        setData(networkData);
                    }
                } catch (err) {
                    // Network unavailable
                }
            }

            if (!cancelled) {
                setLoading(false);
            }
        };

        loadLocalFirst();
        return () => { cancelled = true; };
    }, [cardId]);

    // If we are loading and have no local cache fallback, show the skeleton
    if (loading && !fallbackPrice) return <PriceHeroSkeleton />;
    
    // We determine our display price: use real latest if loaded, else fallback
    let price = fallbackPrice;
    let diff = 0;
    let percent = 0;
    
    if (data && data.length > 0) {
        const latest = data[data.length - 1];
        price = latest.tcgNearMint || latest.tcgNormal || latest.tcgHolo || latest.tcgReverse || latest.tcgFirstEdition || 0;
        
        // Trend calculation (last 2 points)
        const previous = data[data.length - 2];
        const prevPrice = previous?.tcgNearMint || previous?.tcgNormal || previous?.tcgHolo || price;
        diff = price - prevPrice;
        percent = prevPrice !== 0 ? (diff / prevPrice) * 100 : 0;
    }

    return (
    <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Current Market Price
        </span>
        <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight">
                {price > 0 ? `$${price.toFixed(2)}` : 'N/A'}
            </span>
            {diff !== 0 && price > 0 && (
                <div className={`flex items-center text-sm font-bold ${diff > 0 ? 'text-trend-up' : 'text-trend-down'}`}>
                    {diff > 0 ? '▲' : '▼'}
                    <span className="ml-0.5">{Math.abs(percent).toFixed(1)}%</span>
                </div>
            )}
        </div>
    </div>
);
}