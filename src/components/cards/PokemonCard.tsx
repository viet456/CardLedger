import { DenormalizedCard } from '@/src/shared-types/card-index';
import Link from 'next/link';
import Image from 'next/image';

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

interface PokemonCardProps {
    card: DenormalizedCard;
    priority?: boolean;
}

export function PokemonCard({ card, priority = false }: PokemonCardProps) {
    const imageUrl = `${R2_PUBLIC_URL}/${card.img}`;
    return (
        <Link
            href={`/cards/${card.id}`}
            className='flex w-full flex-col rounded-xl bg-card text-card-foreground will-change-transform'
        >
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
                        quality={50}
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
                {/* Use text-sm and muted-foreground for better hierarchy */}
                <p className='text-sm text-muted-foreground'>{card.set.name}</p>
                <p className='text-sm text-muted-foreground'>{card.rarity}</p>
                <p className='text-sm text-muted-foreground'>
                    {card.num}/{card.set.printedTotal}
                </p>
                {card.price ? (
                    <p className='text-lg font-semibold text-green-400'>${card.price.toFixed(2)}</p>
                ) : (
                    <p className='text-lg text-muted-foreground'>N/A</p>
                )}
            </div>
        </Link>
    );
}
