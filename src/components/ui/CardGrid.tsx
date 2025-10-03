import { VirtuosoGrid, VirtuosoGridProps } from 'react-virtuoso';
import { forwardRef, Ref, HTMLAttributes } from 'react';
import { PokemonCard } from './PokemonCard';
import { PokemonCardSkeleton } from './PokemonCardSkeleton';
import { ClientPokemonCardType } from '@/src/types/data';

interface CardGridProps {
    //cards: ClientPokemonCardType[]; // flat array of cards
    totalCount: number;
    isFetchingNextPage?: boolean;
    //prefetchTriggerRef: Ref<HTMLDivElement>
    itemRenderer: (index: number) => React.ReactNode;
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

export function CardGrid({ totalCount, isFetchingNextPage, itemRenderer }: CardGridProps) {
    return (
        <VirtuosoGrid
            style={{ height: '100%' }}
            overscan={20}
            totalCount={totalCount}
            components={{
                ...gridComponents,
                Footer: () => {
                    return isFetchingNextPage ? (
                        <p className='p-4 text-center'>Loading more...</p>
                    ) : null;
                }
            }}
            itemContent={(index) => <div className='flex w-full'>{itemRenderer(index)}</div>}
        />
    );
}
