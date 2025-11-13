export function CardFilterControlsSkeleton() {
    return (
        <div className='flex-shrink-0 animate-pulse px-4 pt-2'>
            {/* Skeleton for Search and filter button */}
            <section className='flex flex-grow gap-2' aria-label='Search and filter skeleton'>
                {/* Search Bar Skeleton */}
                <div className='h-10 flex-grow rounded bg-muted'></div>

                {/* Filter Button Skeleton */}
                {/* We use the same padding as the real button to get the width right */}
                <div className='mt-0 h-10 flex-shrink-0 rounded bg-muted px-10 py-2 md:px-16'>
                    Filters
                </div>
            </section>

            {/* Skeleton for Sort options */}
            {/* Skeletons should represent the default state, which includes sort options */}
            <div
                className='mb-2 mt-6 grid flex-grow grid-cols-2 gap-4'
                aria-label='Sort options skeleton'
            >
                {/* Sort By Skeleton */}
                <div className='h-6 w-full rounded bg-muted'></div>
                {/* Sort Order Skeleton */}
                <div className='h-6 w-full rounded bg-muted'></div>
            </div>
        </div>
    );
}
