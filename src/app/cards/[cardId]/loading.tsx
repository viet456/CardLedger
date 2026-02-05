import { ChevronRight } from 'lucide-react';

export default function Loading() {
    return (
        <div className='flex animate-pulse flex-col gap-8 md:col-span-2'>
            {/* Header: Matches h1 (text-4xl) and p (text-lg) */}
            <header>
                <div className='h-10 w-3/4 rounded bg-muted' /> {/* Title */}
                <div className='mt-2 h-7 w-1/2 rounded bg-muted' /> {/* Subtitle */}
            </header>

            {/* Price Chart Section */}
            <section className='rounded-lg border bg-card p-4 shadow-sm'>
                {/* h2 Title */}
                <div className='mb-2 h-8 w-24 rounded bg-muted' />

                {/* Chart Buttons Row (1m, 3m, 6m...) */}
                <div className='mb-4 flex gap-2'>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className='h-9 flex-1 rounded bg-muted sm:w-12 sm:flex-none' />
                    ))}
                </div>

                {/* The Chart Canvas Area */}
                <div className='h-[300px] w-full rounded-md bg-muted/30' />
            </section>

            {/* Details Grid Section */}
            <section className='rounded-lg border bg-card p-4 shadow-sm'>
                {/* h2 Title */}
                <div className='mb-4 h-8 w-28 rounded bg-muted' />

                {/* Grid matching sm:grid-cols-3 */}
                <div className='grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3'>
                    {/* Render 9 fake detail items to fill the space */}
                    {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i}>
                            {/* Label (text-sm) */}
                            <div className='mb-1 h-4 w-16 rounded bg-muted' />
                            {/* Value (text-base) */}
                            <div className='h-5 w-24 rounded bg-muted' />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
