export function CardFilterControlsSkeleton() {
    return (
        <div className='flex-shrink-0 animate-pulse px-4 pt-2'>
            {/* Top Row: Search + Filter Button/Selects */}
            <div className='flex gap-2'>
                {/* Search Bar - Always grows */}
                <div className='h-12 flex-grow rounded-md bg-muted' />

                {/* Mobile: Filter Drawer Button */}
                <div className='h-12 w-32 flex-shrink-0 rounded-md bg-muted md:hidden' />
            </div>

            {/* Desktop Toolbar - Filter Selects (≥768px) */}
            <div className='mt-2 hidden flex-wrap gap-2 md:flex'>
                {/* 7 filter selects */}
                <div className='h-9 max-w-[240px] flex-grow basis-[150px] rounded-md bg-muted' />
                <div className='h-9 max-w-[240px] flex-grow basis-[150px] rounded-md bg-muted' />
                <div className='h-9 max-w-[240px] flex-grow basis-[150px] rounded-md bg-muted' />
                <div className='h-9 max-w-[240px] flex-grow basis-[150px] rounded-md bg-muted' />
                <div className='h-9 max-w-[240px] flex-grow basis-[150px] rounded-md bg-muted' />
                <div className='h-9 max-w-[240px] flex-grow basis-[150px] rounded-md bg-muted' />
                <div className='h-9 max-w-[240px] flex-grow basis-[150px] rounded-md bg-muted' />

                {/* Reset Button */}
                <div className='h-9 max-w-[140px] flex-grow basis-[100px] rounded-md bg-muted' />
            </div>

            {/* Sort Controls - Always visible */}
            <div className='mb-2 mt-1 grid grid-cols-2 gap-4'>
                <div className='mt-1'>
                    {/* Label */}
                    <div className='mb-1 h-4 w-16 rounded bg-muted' />
                    {/* Select */}
                    <div className='h-9 rounded-md bg-muted' />
                </div>
                <div className='mt-1'>
                    {/* Label */}
                    <div className='mb-1 h-4 w-12 rounded bg-muted' />
                    {/* Select */}
                    <div className='h-9 rounded-md bg-muted' />
                </div>
            </div>
        </div>
    );
}
