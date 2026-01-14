// src/components/cards/PokemonCardSkeleton.tsx
export function PokemonCardSkeleton() {
    return (
        <div className='flex w-full animate-pulse flex-col rounded-xl border border-transparent bg-card'>
            {/* Image placeholder - Matches aspect-[2.5/3.5] */}
            <div className='aspect-[2.5/3.5] w-full rounded-xl bg-muted' />

            {/* INFO AREA - Matches p-3 and gap-1 */}
            <div className='flex flex-col gap-1 p-3'>
                {/* Header Row: Name placeholder */}
                <div className='h-5 w-3/4 rounded bg-muted' />

                {/* Set Name Row */}
                <div className='h-4 w-1/2 rounded bg-muted' />

                {/* Bottom Row: Number + Price */}
                <div className='mt-1 flex items-end justify-between'>
                    {/* Card Number placeholder */}
                    <div className='h-4 w-1/4 rounded bg-muted' />
                    {/* Price placeholder */}
                    <div className='h-5 w-1/3 rounded bg-muted' />
                </div>
            </div>
        </div>
    );
}
