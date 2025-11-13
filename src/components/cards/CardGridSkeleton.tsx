import { PokemonCardSkeleton } from './PokemonCardSkeleton';

export function CardGridSkeleton() {
    return (
        <div className='min-h-screen flex-grow'>
            <div className='grid grid-cols-2 gap-4 px-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
                {Array.from({ length: 20 }).map((_, i) => (
                    <PokemonCardSkeleton key={i} />
                ))}
            </div>
        </div>
    );
}
