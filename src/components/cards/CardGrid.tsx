'use client';

import { VirtuosoGrid, VirtuosoGridProps } from 'react-virtuoso';
import { forwardRef, Ref, HTMLAttributes } from 'react';
import { PokemonCard } from './PokemonCard';
import { DenormalizedCard } from '@/src/shared-types/card-index';

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
            // style={{
            //     display: 'grid',
            //     gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
            //     gap: '16px',
            //     padding: '16px',
            //     ...props.style
            // }}
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
    return (
        <VirtuosoGrid
            useWindowScroll
            overscan={1500}
            totalCount={totalCount}
            components={gridComponents}
            itemContent={(index) => {
                const card = cards[index];
                if (!card) return null;

                return (
                    // Add explicit key to help React reconciliation during scroll
                    <div key={card.id} className='flex w-full'>
                        <PokemonCard card={card} priority={index < 6} />
                    </div>
                );
            }}
        />
    );
}
