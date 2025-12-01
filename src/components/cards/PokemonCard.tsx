import { DenormalizedCard } from '@/src/shared-types/card-index';
import Link from 'next/link';
import Image from 'next/image';
import { CollectionControl } from '../portfolio/CollectionControl';

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

interface PokemonCardProps {
    card: DenormalizedCard;
    priority?: boolean;
    entryId?: string;
}

export function PokemonCard({ card, priority = false, entryId }: PokemonCardProps) {
    const imageUrl = `${R2_PUBLIC_URL}/${card.img}`;
    return (
        <div className='group relative flex w-full flex-col rounded-xl bg-card text-card-foreground transition-transform will-change-transform hover:scale-[1.02]'>
            <div className='absolute right-2 top-2 z-10 opacity-100 transition-opacity duration-200 lg:opacity-0 lg:group-hover:opacity-100'>
                <CollectionControl cardId={card.id} currentPrice={card.price} entryId={entryId} />
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
                    </div>
                ) : (
                    // Placeholder for cards without images
                    <div className='flex aspect-[2.5/3.5] w-full flex-col items-center justify-center rounded-lg bg-muted'>
                        <p className='text-md text-muted-foreground'>No Image</p>
                    </div>
                )}

                {/* --- INFO AREA (Always visible) --- */}
                <div className='p-2'>
                    <p className='truncate text-base font-bold'>{card.n}</p>
                    <p className='text-sm text-muted-foreground'>{card.set.name}</p>
                    <p className='text-sm text-muted-foreground'>{card.rarity}</p>
                    <p className='text-sm text-muted-foreground'>
                        {card.num}/{card.set.printedTotal}
                    </p>
                    {card.price ? (
                        <p className='text-lg font-semibold text-green-400'>
                            ${card.price.toFixed(2)}
                        </p>
                    ) : (
                        <p className='text-lg text-muted-foreground'>N/A</p>
                    )}
                </div>
            </Link>
        </div>
    );
}
