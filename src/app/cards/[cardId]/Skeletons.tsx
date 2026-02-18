import { ChevronRight } from 'lucide-react';

export function DetailsSkeleton() {
    return (
        <div className='flex animate-pulse flex-col gap-8 md:col-span-2'>
            {/* Header */}
            <header>
                <div className='h-10 w-3/4 rounded bg-muted' />
                <div className='mt-2 h-7 w-1/2 rounded bg-muted' />
            </header>

            {/* Price Chart Section */}
            <section className='rounded-lg border bg-card p-4 shadow-sm'>
                <div className='mb-2 h-8 w-24 rounded bg-muted' />
                <div className='mb-4 flex gap-2'>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className='h-9 flex-1 rounded bg-muted sm:w-12 sm:flex-none' />
                    ))}
                </div>
                <div className='h-[300px] w-full rounded-md bg-muted/30' />
            </section>

            {/* Details Grid Section */}
            <section className='rounded-lg border bg-card p-4 shadow-sm'>
                <div className='mb-4 h-8 w-28 rounded bg-muted' />
                <div className='grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3'>
                    {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i}>
                            <div className='mb-1 h-4 w-16 rounded bg-muted' />
                            <div className='h-5 w-24 rounded bg-muted' />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

export function BreadcrumbSkeleton() {
    return (
        <div className='mb-6 flex h-5 w-48 animate-pulse items-center gap-2 rounded bg-muted/50' />
    );
}

export function ImageSkeleton() {
    return <div className='aspect-[2.5/3.5] w-full animate-pulse rounded-xl bg-muted' />;
}
