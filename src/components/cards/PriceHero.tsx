'use client';

import { useEffect, useState } from 'react';
import { PriceHistoryDataPoint } from '@/src/shared-types/price-api';
import { PriceHeroSkeleton } from '@/src/app/cards/[cardId]/Skeletons';

export function PriceHero({ cardId }: { cardId: string }) {
    const [data, setData] = useState<PriceHistoryDataPoint[] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Uses the same endpoint as PriceHistoryChart
        fetch(`/api/prices/${cardId}`)
            .then(res => res.json())
            .then(setData)
            .finally(() => setLoading(false));
    }, [cardId]);

    if (loading) return <PriceHeroSkeleton />;
    if (!data || data.length === 0) return null;

    const latest = data[data.length - 1];
    // Selecting the primary price 
    const price = latest.tcgNearMint || latest.tcgNormal || latest.tcgHolo || latest.tcgReverse || latest.tcgFirstEdition || 0;
    
    // Trend calculation (last 2 points)
    const previous = data[data.length - 2];
    const prevPrice = previous?.tcgNearMint || previous?.tcgNormal || previous?.tcgHolo || price;
    const diff = price - prevPrice;
    const percent = prevPrice !== 0 ? (diff / prevPrice) * 100 : 0;

    return (
    <div className="flex flex-col gap-1">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Current Market Price
        </span>
        <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight">
                ${price.toFixed(2)}
            </span>
            {diff !== 0 && (
                <div className={`flex items-center text-sm font-bold ${diff > 0 ? 'text-trend-up' : 'text-trend-down'}`}>
                    {diff > 0 ? '▲' : '▼'}
                    <span className="ml-0.5">{Math.abs(percent).toFixed(1)}%</span>
                </div>
            )}
        </div>
    </div>
);
}