import Image from 'next/image';
import { DenormalizedCard } from '@/src/lib/store/cardStore';

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

export function PokemonCard({ card }: { card: DenormalizedCard }) {
    const imageUrl = `${R2_PUBLIC_URL}/${card.img}`;
    return (
        <div className='flex w-full flex-col rounded-xl bg-card text-card-foreground'>
            {card.img ? (
                <div className='relative aspect-[2.5/3.5] w-full'>
                    <Image
                        src={imageUrl}
                        alt={card.n}
                        fill
                        className='object-contain'
                        sizes='(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw'
                        loading='eager'
                    />
                </div>
            ) : (
                // Placeholder for cards without images
                <div className='flex aspect-[2.5/3.5] w-full items-center justify-center bg-muted'>
                    <p className='text-xs text-muted-foreground'>No Image</p>
                </div>
            )}

            {/* <div className='p-2'>
                <p className='truncate font-bold'>{card.name}</p>
                <p className='text-sm text-muted-foreground'>{card.id}</p>
                <p className='mt-auto text-xs'>
                    {card.set.name} - {card.number}/{card.set.printedTotal}
                </p>
            </div> */}
        </div>
    );
}
