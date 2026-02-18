import { DenormalizedCard } from '@/src/shared-types/card-index';
import { CardPrices } from '@/src/shared-types/price-api';
import { format } from 'date-fns';
import { CollectionControl } from '../portfolio/CollectionControl';
import { TransitionLink } from '@/src/components/ui/TransitionLink';
import { ResilientImage } from './ResilientImage';
import r2ImageLoader from '@/src/lib/loader';
import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DashboardCard extends DenormalizedCard {
    uniqueId?: string;
    collectionStats?: {
        cost: number;
        acquiredAt: Date;
        variant: string;
    };
}

interface PokemonCardProps {
    card: DashboardCard;
    priority?: boolean;
    entryId?: string;
    collectionStats?: {
        cost: number;
        acquiredAt: Date;
        variant: string;
    };
}

export function PokemonCard({
    card,
    priority = false,
    entryId,
    collectionStats: propStats
}: PokemonCardProps) {
    const cardHref = card.img
        ? `/cards/${card.id}?preview=${encodeURIComponent(card.img)}`
        : `/cards/${card.id}`;

    const stats = propStats || card.collectionStats;

    //-- PRICE SELECTION LOGIC --
    const currentPrice = useMemo(() => {
        if (card.variants) {
            if (stats?.variant) {
                const variantKey = `tcg${stats.variant}` as keyof CardPrices;
                const specificPrice = card.variants[variantKey];
                if (typeof specificPrice === 'number') return specificPrice;
            }
            return card.variants.tcgNearMint 
                ?? card.variants.tcgNormal 
                ?? card.variants.tcgHolo 
                ?? card.variants.tcgReverse 
                ?? card.variants.tcgFirstEdition 
                ?? 0;
        }
        return card.price || 0;
    }, [card.variants, card.price, stats?.variant]);

    // --- FINANCIAL LOGIC ---
    const cost = stats ? stats.cost : 0;
    const gain = stats ? currentPrice - cost : 0;
    const rawPercent = cost > 0 ? (gain / cost) * 100 : 0;

    const displayPercent = Math.abs(rawPercent).toFixed(0);
    const isNeutral = displayPercent === '0';
    
    let overlayColor = 'text-zinc-300'; 
    let bodyColor = 'text-muted-foreground'; 
    
    let TrendIconComponent = Minus;

    if (!isNeutral) {
        if (rawPercent > 0) {
            overlayColor = 'text-emerald-400'; 
            bodyColor = 'text-trend-up';
            TrendIconComponent = TrendingUp;
        } else {
            overlayColor = 'text-rose-400';
            bodyColor = 'text-trend-down';
            TrendIconComponent = TrendingDown;
        }
    }

    const variantLabel = useMemo(() => {
        if (!stats?.variant) return '';
        const labels: Record<string, string> = {
            'Normal': 'Normal',
            'Holo': 'Holo',
            'Reverse': 'Reverse',
            'FirstEdition': '1st Ed'
        };
        return labels[stats.variant] || stats.variant;
    }, [stats?.variant]);

    return (
        <div className='group relative flex w-full flex-col rounded-xl bg-card text-card-foreground transition-transform will-change-transform hover:scale-[1.02]'>
            
            <div className='absolute right-2 top-2 z-10 opacity-100 transition-opacity duration-200 lg:opacity-0 lg:focus-within:opacity-100 lg:group-hover:opacity-100'>
                <CollectionControl
                    cardId={card.id}
                    currentPrice={card.price}
                    entryId={entryId || card.uniqueId}
                    cardName={card.n}
                />
            </div>

            <TransitionLink href={cardHref} prefetch={true} className='flex h-full w-full flex-col'>
                {/* --- IMAGE AREA --- */}
                <div className='relative aspect-[2.5/3.5] w-full'>
                    <ResilientImage
                        loader={r2ImageLoader}
                        src={card.img}
                        alt={card.n}
                        fill
                        sizes='192px'
                        className='object-cover'
                        loading={priority ? 'eager' : 'lazy'}
                        fetchPriority={priority ? 'high' : 'auto'}
                        style={{
                            viewTransitionName: `card-image-${card.id}`,
                            viewTransitionClass: 'card-expand'
                        }}
                    />
                    
                    {stats && (
                        <div className='absolute bottom-0 left-0 rounded-tr-lg bg-black/80 px-2 py-1 text-xs font-bold text-white'>
                            {variantLabel}
                        </div>
                    )}

                    {stats && (
                        <div className={`absolute bottom-0 right-0 z-10 flex min-w-[60px] items-center justify-center gap-1.5 rounded-tl-lg bg-black/80 px-2 py-1 text-xs font-bold font-mono ${overlayColor}`}>
                            <TrendIconComponent className="h-3.5 w-3.5 stroke-[3px]" />
                            {displayPercent}%
                        </div>
                    )}
                </div>

                {/* --- INFO AREA --- */}
                <div className='flex h-[5.5rem] flex-col gap-1 py-2'>
                    
                    <div className='flex w-full items-start justify-between px-2'>
                        <p className='truncate text-sm font-bold leading-snug w-full'>
                            {card.n}
                        </p>
                    </div>

                    {stats ? (
                        <div className='mt-auto flex items-end justify-between border-t border-border/50 px-1 md:px-2 pt-1'>
                            <div className='flex flex-col gap-0'>
                                <span className='text-[10px] uppercase tracking-wider text-muted-foreground'>
                                    Acquired
                                </span>
                                <span className='whitespace-nowrap text-[10px] font-medium leading-tight'>
                                    {format(new Date(stats.acquiredAt), 'MMM d, yy')}
                                </span>
                            </div>

                            <div className='flex flex-col items-end gap-0.5'>
                                <div className='flex items-baseline gap-1'>
                                    {/* BODY: Uses 'bodyColor' (Darker on White / Lighter on Dark) */}
                                    <span className={`text-sm font-bold ${bodyColor}`}>
                                        ${currentPrice.toFixed(2)}
                                    </span>
                                </div>
                                <div className='flex items-baseline gap-1'>
                                    <span className='text-[10px] text-muted-foreground'>Cost:</span>
                                    <span className='text-xs text-muted-foreground'>
                                        ${cost.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className='flex flex-grow flex-col justify-between px-2'>
                            <p className='truncate text-xs text-muted-foreground'>
                                {card.set.name}
                            </p>
                            
                            <div className='mt-1 flex items-end justify-between'>
                                <p className='text-xs text-muted-foreground'>
                                    {card.num}/{card.set.printedTotal}
                                </p>
                                {card.price ? (
                                    <p className='text-trend-up text-sm font-semibold'>
                                        ${card.price.toFixed(2)}
                                    </p>
                                ) : (
                                    <p className='text-sm text-muted-foreground'>N/A</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </TransitionLink>
        </div>
    );
}