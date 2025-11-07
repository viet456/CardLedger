export function PokemonCardSkeleton() {
    return (
        <div className='flex w-full animate-pulse flex-col rounded-xl bg-card'>
            {/* Image placeholder */}
            <div className='flex aspect-[2.5/3.5] w-full rounded-xl border bg-card' />
            {/* Text placeholder */}
            <div className='p-2'>
                {/* Title */}
                <div className='h-6 w-3/4 rounded bg-muted' />
                {/* Set Name */}
                <div className='h-5 w-1/2 rounded bg-muted' />
                {/* Rarity */}
                <div className='h-5 w-1/2 rounded bg-muted' />
                {/* Numbers */}
                <div className='h-5 w-1/4 rounded bg-muted' />
                {/* Price */}
                <div className='h-7 w-1/3 rounded bg-muted' />
            </div>
        </div>
    );
}
