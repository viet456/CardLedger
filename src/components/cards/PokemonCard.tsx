import { DenormalizedCard } from '@/src/shared-types/card-index';
import Link from 'next/link';
import Image from 'next/image';
import { CollectionControl } from '../portfolio/CollectionControl';
import { format } from 'date-fns';

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

interface DashboardCard extends DenormalizedCard {
    collectionStats?: {
        cost: number;
        acquiredAt: Date;
        condition: string;
    };
}
interface PokemonCardProps {
    card: DashboardCard;
    priority?: boolean;
    entryId?: string;
    // Optional collection stats if used outside of /dashboard or /cards or /setId/
    collectionStats?: {
        cost: number;
        acquiredAt: Date;
        condition: string;
    };
}

export function PokemonCard({
    card,
    priority = false,
    entryId,
    collectionStats: propStats
}: PokemonCardProps) {
    const imageUrl = `${R2_PUBLIC_URL}/${card.img}`;

    const stats = propStats || card.collectionStats;

    const currentPrice = card.price || 0;
    const gain = stats ? currentPrice - stats.cost : 0;
    const isProfit = gain >= 0;

    const conditionLabel = stats?.condition.replace('tcg', '').replace(/([A-Z])[a-z]+/g, '$1');
    return (
        <div className='group relative flex w-full flex-col rounded-xl bg-card text-card-foreground transition-transform will-change-transform hover:scale-[1.02]'>
            <div className='absolute right-2 top-2 z-10 opacity-100 transition-opacity duration-200 lg:opacity-0 lg:focus-within:opacity-100 lg:group-hover:opacity-100'>
                {' '}
                <CollectionControl
                    cardId={card.id}
                    currentPrice={card.price}
                    entryId={entryId || (card as any).uniqueId}
                />
            </div>

            <Link href={`/cards/${card.id}`} className='flex h-full w-full flex-col'>
                {card.img ? (
                    <div className='relative aspect-[2.5/3.5] w-full'>
                        <Image
                            src={imageUrl}
                            alt={card.n}
                            fill
                            className='object-cover'
                            sizes='192px'
                            loading={priority ? 'eager' : 'lazy'}
                            fetchPriority={priority ? 'high' : 'auto'}
                        />
                        {/* Overlay Badge for Condition */}
                        {stats && (
                            <div className='absolute bottom-0 left-0 rounded-tr-lg bg-black/70 px-2 py-1 text-xs font-bold text-white'>
                                {conditionLabel}
                            </div>
                        )}
                    </div>
                ) : (
                    // Placeholder for cards without images
                    <div className='flex aspect-[2.5/3.5] w-full flex-col items-center justify-center rounded-lg bg-muted'>
                        <p className='text-md text-muted-foreground'>No Image</p>
                    </div>
                )}

                {/* --- INFO AREA --- */}
                <div className='flex flex-col gap-1 p-3'>
                    {/* Header: Name + Profit Badge */}
                    <div className='flex items-start justify-between gap-2'>
                        <p className='truncate text-sm font-bold leading-snug'>{card.n}</p>
                        {stats && (
                            <span
                                className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs ${
                                    isProfit
                                        ? 'bg-emerald-500/10 text-emerald-500'
                                        : 'bg-red-500/10 text-red-500'
                                }`}
                            >
                                {isProfit ? '▲' : '▼'}{' '}
                                {Math.abs(stats.cost > 0 ? (gain / stats.cost) * 100 : 0).toFixed(
                                    0
                                )}
                                %
                            </span>
                        )}
                    </div>

                    {stats ? (
                        // --- DASHBOARD MODE ---
                        <div className='border-border/50 mt-2 flex flex-col gap-1 border-t pt-2'>
                            {/* Row 1: Date */}
                            <div className='flex justify-between text-xs uppercase tracking-wide text-muted-foreground'>
                                <span>Acquired</span>
                                <span>{format(new Date(stats.acquiredAt), 'MMM d, yy')}</span>
                            </div>

                            {/* Row 2: Cost vs Value Grid */}
                            <div className='grid grid-cols-2 gap-2 text-xs'>
                                <div>
                                    <span className='block text-xs text-muted-foreground'>
                                        Cost
                                    </span>
                                    <span className='font-medium text-foreground'>
                                        ${stats.cost.toFixed(0)}
                                    </span>
                                </div>
                                <div className='text-right'>
                                    <span className='block text-xs text-muted-foreground'>
                                        Value
                                    </span>
                                    <span
                                        className={`block text-sm font-bold ${
                                            isProfit ? 'text-emerald-500' : 'text-red-500'
                                        }`}
                                    >
                                        ${currentPrice.toFixed(0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // --- PUBLIC MODE (Standard Layout) ---
                        <>
                            <p className='text-xs text-muted-foreground'>{card.set.name}</p>
                            <div className='mt-1 flex items-end justify-between'>
                                <p className='text-xs text-muted-foreground'>
                                    {card.num}/{card.set.printedTotal}
                                </p>
                                {card.price ? (
                                    <p className='text-sm font-semibold text-green-500'>
                                        ${card.price.toFixed(2)}
                                    </p>
                                ) : (
                                    <p className='text-sm text-muted-foreground'>N/A</p>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </Link>
        </div>
    );
}
