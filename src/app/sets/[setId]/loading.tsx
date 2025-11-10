function SetPageSkeleton() {
    return (
        <div className='flex w-full flex-grow flex-col'>
            {/* Skeleton for set name header */}
            <div className='h-9'></div>
            {/* Skeleton for CardFilterControls */}
            <div className='mb-4 animate-pulse px-4 pt-2'>
                {/* Searchbar Skeleton */}
                <div className='mb-6 h-10 w-full rounded bg-muted'></div>
                {/* Sort Order Skeleton */}
                <section className='mb-4 grid grid-cols-2 gap-4'>
                    <div className='h-6 rounded bg-muted'></div>
                    <div className='h-6 rounded bg-muted'></div>
                </section>
                {/* Filter Button Skeleton */}
                <div className='mt-6 h-10 w-full rounded bg-muted'></div>
            </div>
            {/* Skeleton for CardGrid */}
            <div className='min-h-screen flex-grow'>
                <div className='grid grid-cols-2 gap-4 px-4 pb-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div
                            key={i}
                            className='flex aspect-[2.5/3.5] w-full animate-pulse rounded-xl border bg-card'
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default function Loading() {
    return <SetPageSkeleton />;
}
