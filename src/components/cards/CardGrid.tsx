'use client';

import { VirtuosoGrid, VirtuosoGridProps } from 'react-virtuoso';
import { forwardRef, HTMLAttributes } from 'react';
import { PokemonCard } from './PokemonCard';
import { DenormalizedCard } from '@/src/shared-types/card-index';
import { useScrollStore } from '@/src/lib/store/scrollStore';

interface CardGridProps {
    cards: DenormalizedCard[];
    totalCount: number;
    priority?: boolean;
}

const GridList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => (
        <div
            ref={ref}
            {...props}
            className='grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
        >
            {children}
        </div>
    )
);
GridList.displayName = 'GridList';

const GridItem = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>((props, ref) => (
    <div ref={ref} {...props} className='flex h-full w-full self-stretch' />
));
GridItem.displayName = 'GridItem';

const gridComponents: VirtuosoGridProps<DenormalizedCard, undefined>['components'] = {
    List: GridList,
    Item: GridItem
};

export function CardGrid({ cards, totalCount }: CardGridProps) {
    const { scrollIndex, setScrollIndex } = useScrollStore();

    return (
        <VirtuosoGrid
            useWindowScroll
            overscan={1500}
            totalCount={totalCount}
            components={gridComponents}
            initialTopMostItemIndex={scrollIndex}
            rangeChanged={({ startIndex }) => {
                setScrollIndex(startIndex);
            }}
            itemContent={(index) => {
                const card = cards[index];
                if (!card) return null;

                return (
                    <div key={card.id} className='relative flex w-full pb-1'>
                        <PokemonCard card={card} priority={index < 6} />
                    </div>
                );
            }}
        />
    );
}
