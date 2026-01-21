import { ChevronRight } from 'lucide-react';

export default function Loading() {
    return (
        <main className='container mx-auto max-w-6xl animate-pulse p-4 sm:p-6 lg:p-8'>
            {/* Breadcrumb Skeleton */}
            <nav className='mb-6 flex items-center space-x-2 text-sm text-muted-foreground'>
                <div className='h-4 w-12 rounded bg-muted' />
                <ChevronRight className='h-4 w-4' />
                <div className='h-4 w-32 rounded bg-muted' />
            </nav>

            <div className='grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-12'>
                {/* Left Column: Image Skeleton */}
                <div className='md:col-span-1'>
                    <div className='aspect-[2.5/3.5] w-full rounded-xl bg-muted shadow-lg' />
                </div>

                {/* Right Column: Data Skeleton */}
                <div className='flex flex-col gap-8 md:col-span-2'>
                    <header>
                        <div className='mb-2 h-10 w-3/4 rounded bg-muted' />
                        <div className='h-6 w-1/2 rounded bg-muted' />
                    </header>

                    {/* Prices Section Skeleton */}
                    <section className='rounded-lg border bg-card p-4 shadow-sm'>
                        <div className='mb-4 h-8 w-24 rounded bg-muted' />
                        {/* Match PriceHistoryChart structure: Buttons + Chart Area */}
                        <div className='mb-4 flex gap-2'>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div
                                    key={i}
                                    className='h-9 flex-1 rounded bg-muted sm:w-12 sm:flex-none'
                                />
                            ))}
                        </div>
                        <div className='h-[300px] w-full rounded-md bg-muted/30' />
                    </section>

                    {/* Details Section Skeleton */}
                    <section className='rounded-lg border bg-card p-4 shadow-sm'>
                        <div className='mb-4 h-8 w-28 rounded bg-muted' />
                        <div className='grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3'>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className='space-y-2'>
                                    <div className='h-3 w-16 rounded bg-muted' />
                                    <div className='h-5 w-24 rounded bg-muted' />
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
