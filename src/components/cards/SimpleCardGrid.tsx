import { DenormalizedCard } from '@/src/shared-types/card-index';
import { PokemonCard } from './PokemonCard';

interface SimpleCardGridProps {
    cards: DenormalizedCard[];
}

export function SimpleCardGrid({ cards }: SimpleCardGridProps) {
    return (
        <div className='grid grid-cols-2 gap-4 px-4 pt-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
            {cards.map((card, index) => (
                <PokemonCard key={card.id} card={card} priority={index < 12} />
            ))}
        </div>
    );
}
