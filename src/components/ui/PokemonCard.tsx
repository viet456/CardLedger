import type { ClientPokemonCardType } from '@/src/types/data';
import Image from 'next/image';

export function PokemonCard({ card }: { card: ClientPokemonCardType }) {
    const imageUrl = `https://pub-824918a696694722afa7ba2876533a1e.r2.dev/${card.imageKey}`;
    return (
        <div className='flex w-full flex-col rounded-xl border bg-card text-card-foreground'>
            {card.imageKey ? (
                <div className='relative aspect-[2.5/3.5] w-full'>
                    <Image
                        src={imageUrl}
                        alt={card.name}
                        fill
                        className='object-contain'
                        sizes='(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw'
                    />
                </div>
            ) : (
                // Placeholder for cards without images
                <div className='flex aspect-[2.5/3.5] w-full items-center justify-center bg-muted'>
                    <p className='text-xs text-muted-foreground'>No Image</p>
                </div>
            )}

            <div className='p-2'>
                <p className='truncate font-bold'>{card.name}</p>
                <p className='text-sm text-muted-foreground'>{card.id}</p>
                <p className='mt-auto text-xs'>
                    {card.set.name} - {card.number}/{card.set.printedTotal}
                </p>
            </div>
        </div>
    );
}
