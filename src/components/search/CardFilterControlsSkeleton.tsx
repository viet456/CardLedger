interface CardFilterControlsSkeletonProps {
    layout?: 'row' | 'sidebar';
}

export function CardFilterControlsSkeleton({ layout = 'row' }: CardFilterControlsSkeletonProps) {
    // --- SIDEBAR LAYOUT SKELETON ---
    if (layout === 'sidebar') {
        return (
            <div className='flex animate-pulse flex-col gap-4'>
                {/* Search Bar */}
                <div className='w-full shrink-0'>
                    <div className='h-12 w-full rounded-md bg-muted' />
                </div>

                {/* Sort Controls (2fr 1fr split) */}
                <div className='grid shrink-0 grid-cols-[2fr_1fr] gap-3'>
                    <div className='col-span-2 h-2 w-10 rounded bg-muted' /> {/* Label "Sort" */}
                    <div className='h-9 w-full rounded-md bg-muted' />
                    <div className='h-9 w-full rounded-md bg-muted' />
                </div>

                {/* Filters Stack */}
                <div className='flex flex-col gap-3 pt-2'>
                    <div className='h-2 w-12 rounded bg-muted' /> {/* Label "Filters" */}
                    <div className='h-9 w-full rounded-md bg-muted' />
                    <div className='h-9 w-full rounded-md bg-muted' />
                    <div className='h-9 w-full rounded-md bg-muted' />
                    <div className='h-9 w-full rounded-md bg-muted' />
                    <div className='h-9 w-full rounded-md bg-muted' />
                    <div className='h-9 w-full rounded-md bg-muted' />
                </div>

                {/* Clear Button */}
                <div className='mt-1 h-9 w-full shrink-0 rounded-md bg-muted' />
            </div>
        );
    }

    // --- ROW LAYOUT SKELETON (Default) ---
    return (
        <div className='flex-shrink-0 animate-pulse pt-2 md:px-4'>
            {/* Top Row: Search + Mobile Toggle */}
            <div className='flex gap-2'>
                <div className='h-12 flex-grow rounded-md bg-muted' />
                <div className='h-12 w-32 flex-shrink-0 rounded-md bg-muted md:hidden' />
            </div>

            {/* Desktop Toolbar - Filter Selects (≥768px) */}
            <div className='mt-2 hidden flex-wrap gap-2 md:flex'>
                {/* Simulate 7 filter inputs */}
                {Array.from({ length: 7 }).map((_, i) => (
                    <div
                        key={i}
                        className='h-9 max-w-[240px] flex-grow basis-[150px] rounded-md bg-muted'
                    />
                ))}
                {/* Reset Button */}
                <div className='h-10 max-w-[140px] flex-grow basis-[100px] rounded-md bg-muted' />
            </div>
            {/* Desktop search bar */}
            <div className='mt-2 hidden grid-cols-2 gap-3 pb-2 md:grid'>
                <div className='h-9 rounded bg-muted' />
                <div className='h-9 rounded bg-muted' />
            </div>

            {/* Mobile Sort Controls */}
            <div className='mb-2 mt-2 grid grid-cols-2 gap-2 md:hidden'>
                <div className='h-9 rounded-md bg-muted' />
                <div className='h-9 rounded-md bg-muted' />
            </div>
        </div>
    );
}
