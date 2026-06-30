'use client';

import { PriceHeroSkeleton } from '@/src/app/cards/[cardId]/Skeletons';
import { useMarketStore } from '@/src/lib/store/marketStore';
import { useCardLatestPrices } from '@/hooks/useCardHistory';
import { useCardStore } from '@/src/lib/store/cardStore';
import { getTcgPlayerUrl } from '@/src/utils/tcgplayer';
import { denormalizeSingleCard } from '@/src/utils/cardUtils';

export function PriceHero({ cardId }: { cardId: string }) {
    const { trend, loading } = useCardLatestPrices(cardId);

    // Attempt to get instant price from market cache as fallback
    const cachedPrices = useMarketStore(state => state.prices[cardId]);
    const fallbackPrice = cachedPrices 
        ? (cachedPrices.tcgNearMint || cachedPrices.tcgNormal || cachedPrices.tcgHolo || cachedPrices.tcgReverse || cachedPrices.tcgFirstEdition || 0)
        : 0;

    // Compute TCGPlayer URL from client store
    const store = useCardStore();
    const normalizedCard = store.cardMap.get(cardId);
    const denormalized = normalizedCard ? denormalizeSingleCard(normalizedCard, store) : null;
    const tcgPlayerUrl = denormalized 
        ? getTcgPlayerUrl(denormalized.tcgPlayerId, denormalized.n, denormalized.set?.name)
        : `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(cardId)}`;

    // If we are loading and have no local cache fallback, show the skeleton
    if (loading && !fallbackPrice) return <PriceHeroSkeleton />;

    // Use hook-computed trend when available, fall back to cached market price
    const price = trend.price || fallbackPrice;
    const { diff, percent } = trend;

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
        <a
            href={tcgPlayerUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1.5 mt-1 text-xs font-semibold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline-offset-2 hover:underline transition-colors w-fit"
        >
            Buy on TCGplayer
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7" /><path d="M7 7h10v10" />
            </svg>
        </a>
    </div>
);
}