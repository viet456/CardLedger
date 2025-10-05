import { CldImage } from 'next-cloudinary';
import { DenormalizedCard } from '@/src/shared-types/card-index';
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

interface PokemonCardProps {
    card: DenormalizedCard;
    priority?: boolean;
}

export function PokemonCard({ card, priority = false }: PokemonCardProps) {
    // const imageUrl = `${R2_PUBLIC_URL}/${card.img}`;
    return (
        <div className='flex w-full flex-col rounded-xl bg-card text-card-foreground'>
            {card.img ? (
                <div className='relative aspect-[2.5/3.5] w-full'>
                    {/* Get image from Cloudinary store */}
                    <CldImage
                        src={card.img}
                        alt={card.n}
                        fill
                        className='object-cover'
                        sizes='192px'
                        loading='eager'
                        fetchPriority={priority ? 'high' : 'auto'}
                        quality='50'
                        format='avif'
                    />
                </div>
            ) : (
                // Placeholder for cards without images
                <div className='flex aspect-[2.5/3.5] w-full flex-col items-center justify-center rounded-lg bg-muted'>
                    <p className='text-md text-muted-foreground'>No Image</p>
                </div>
            )}

            {/* --- INFO AREA (Always visible) --- */}
            <div className='p-2 text-xs'>
                <p className='truncate text-base font-bold'>{card.n}</p>
                <p>{card.set.name}</p>
                <p>{card.rarity}</p>
                <p>
                    {card.num}/{card.set.printedTotal}
                </p>
            </div>
        </div>
    );
}
