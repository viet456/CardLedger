import { CardFilterControlsSkeleton } from '@/src/components/search/CardFilterControlsSkeleton';
import { CardGridSkeleton } from '@/src/components/cards/CardGridSkeleton';

function SetPageSkeleton() {
    return (
        <div className='flex w-full flex-grow flex-col'>
            {/* Skeleton for set name header */}
            <div className='h-9'></div>
            {/* Skeleton for CardFilterControls */}
            <CardFilterControlsSkeleton />
            {/* Skeleton for CardGrid */}
            <CardGridSkeleton />
        </div>
    );
}

export default function Loading() {
    return <SetPageSkeleton />;
}
