import { Skeleton } from '@/src/components/ui/skeleton';
import { CardFilterControlsSkeleton } from '@/src/components/search/CardFilterControlsSkeleton';
import { CardGridSkeleton } from '@/src/components/cards/CardGridSkeleton';

export function DashboardSkeleton() {
    return (
        <main className='mx-auto flex min-h-screen w-full animate-pulse flex-col space-y-4 p-6 text-foreground'>
            {/* Title and Welcome Message */}
            <Skeleton className='h-8 w-40' />
            <Skeleton className='h-5 w-60' />

            {/* Tabs List */}
            <div className='flex items-center justify-between'>
                <div className='flex space-x-2 rounded-lg bg-muted p-1'>
                    {/* Gallery Tab */}
                    <Skeleton className='h-9 w-24 rounded-md' />
                    {/* Ledger Tab */}
                    <Skeleton className='h-9 w-24 rounded-md' />
                </div>
            </div>

            {/* Main Collection View Skeleton */}
            <div className='mt-6 flex-grow'>
                {/* The CollectionPageView in the final state renders a CardFilterControls 
                    followed by the SimpleCardGrid inside a bordered container.
                */}
                <div className='rounded-xl border border-border bg-background text-card-foreground shadow-sm'>
                    {/* Replaced custom filter skeleton with the dedicated component */}
                    <div className='border-b border-border p-6'>
                        <CardFilterControlsSkeleton />
                    </div>

                    {/* Card Grid Placeholder - Contains Status/Count Text and the Grid */}
                    <div className='bg-muted/10 min-h-[500px] p-6'>
                        {/* Status/Count Text */}
                        <Skeleton className='mb-4 h-4 w-40' />

                        {/* Replaced custom card grid skeleton with the dedicated component */}
                        <CardGridSkeleton />
                    </div>
                </div>
            </div>
        </main>
    );
}
