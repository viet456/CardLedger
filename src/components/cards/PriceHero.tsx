'use client';

import { PriceHeroSkeleton } from '@/src/app/cards/[cardId]/Skeletons';
import { useMarketStore } from '@/src/lib/store/marketStore';
import { useCardLatestPrices } from '@/hooks/useCardHistory';
import { useCardStore } from '@/src/lib/store/cardStore';
import { getTcgPlayerUrl } from '@/src/utils/tcgplayer';
import { denormalizeSingleCard } from '@/src/utils/cardUtils';
import { useFormatPrice } from '@/src/lib/store/currencyStore';

interface PriceHeroProps {
    cardId: string;
    initialPrice?: number | null;
    cardName?: string;
    setName?: string;
    tcgPlayerId?: number | null;
}

export function PriceHero({
    cardId,
    initialPrice,
    cardName,
    setName,
    tcgPlayerId
}: PriceHeroProps) {
    const { trend, loading } = useCardLatestPrices(cardId);
    const formatPrice = useFormatPrice();

    // Attempt to get instant price from client market cache first, falling back to
    // server-cached MarketStats price (for instant SSR/LCP + visible JSON-LD parity)
    const cachedPrices = useMarketStore((state) => state.prices[cardId]);
    const clientMarketPrice = cachedPrices
        ? cachedPrices.tcgNearMint ||
          cachedPrices.tcgNormal ||
          cachedPrices.tcgHolo ||
          cachedPrices.tcgReverse ||
          cachedPrices.tcgFirstEdition ||
          0
        : 0;
    const fallbackPrice = clientMarketPrice || (initialPrice ?? 0);

    // Compute TCGPlayer URL from client store with SSR prop fallback
    const store = useCardStore();
    const normalizedCard = store.cardMap.get(cardId);
    const denormalized = normalizedCard ? denormalizeSingleCard(normalizedCard, store) : null;
    const resolvedName = denormalized?.n ?? cardName;
    const resolvedSetName = denormalized?.set?.name ?? setName;
    const resolvedTcgPlayerId = denormalized ? denormalized.tcgPlayerId : (tcgPlayerId ?? null);
    const tcgPlayerUrl = resolvedName
        ? getTcgPlayerUrl(resolvedTcgPlayerId, resolvedName, resolvedSetName)
        : `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(cardId)}`;

    // If we are loading and have neither client nor server fallback price, show skeleton
    if (loading && !fallbackPrice) return <PriceHeroSkeleton />;

    // Use hook-computed trend (from daily R2 history) when available, else fallback price
    const price = trend.price || fallbackPrice;
    const { diff, percent } = trend;

    return (
        <div className='flex flex-col gap-1'>
            <span className='text-xs font-bold uppercase tracking-widest text-muted-foreground'>
                Current Market Price
            </span>
            <div className='flex items-baseline gap-2'>
                <span className='text-3xl font-bold tracking-tight' suppressHydrationWarning>
                    {price > 0 ? formatPrice(price) : 'N/A'}
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