import { VirtuosoGrid, VirtuosoGridProps } from 'react-virtuoso';
import { forwardRef, Ref, HTMLAttributes } from 'react';
import { PokemonCard } from './PokemonCard';
import { PokemonCardSkeleton } from './PokemonCardSkeleton';
import { ClientPokemonCardType } from '@/src/types/data';
import { DenormalizedCard } from '@/src/lib/store/cardStore';

interface CardGridProps {
    cards: DenormalizedCard[];
    totalCount: number;
    isLoading: boolean;
    priority?: boolean;
}

const GridList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => (
        <div
            ref={ref}
            {...props}
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: '16px',
                padding: '16px',
                ...props.style
            }}
        >
            {children}
        </div>
    )
);
GridList.displayName = 'GridList';
const GridItem = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, ref) => (
    <div ref={ref} {...props} className='flex self-stretch' />
));
GridItem.displayName = 'GridItem';
const gridComponents: VirtuosoGridProps<ClientPokemonCardType, undefined>['components'] = {
    List: GridList,
    Item: GridItem
};

export function CardGrid({ cards, totalCount, isLoading }: CardGridProps) {
    return (
        <VirtuosoGrid
            style={{ height: '100%' }}
            overscan={2000}
            totalCount={totalCount}
            components={{
                ...gridComponents
            }}
            itemContent={(index) => (
                <div className='flex w-full'>
                    {isLoading ? (
                        <PokemonCardSkeleton />
                    ) : (
                        <PokemonCard card={cards[index]} priority={index < 12} />
                    )}
                </div>
            )}
        />
    );
}
