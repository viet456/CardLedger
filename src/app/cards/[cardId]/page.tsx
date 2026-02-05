import { Suspense } from 'react';
import { CardImageDisplay } from './CardImageDisplay';
import { CardDetails } from './CardDetails';
import { CardBreadcrumbs } from './CardBreadcrumbs';
export default async function SingleCardPage({
    params,
    searchParams
}: {
    params: Promise<{ cardId: string }>;
    searchParams: Promise<{ preview?: string }>;
}) {
    const { cardId } = await params;
    const { preview } = await searchParams;
    const previewImg = preview ? decodeURIComponent(preview) : '';

    return (
        <main className='container mx-auto max-w-6xl p-4 sm:p-6 lg:p-8'>
            <Suspense fallback={<BreadcrumbSkeleton />}>
                <CardBreadcrumbs cardId={cardId} />
            </Suspense>

            <div className='grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-12'>
                {/* --- LEFT COLUMN --- */}
                <div className='md:col-span-1'>
                    {previewImg ? (
                        <CardImageDisplay img={previewImg} name='Card Image' id={cardId} />
                    ) : (
                        <div className='aspect-[2.5/3.5] w-full rounded-xl bg-muted shadow-lg' />
                    )}
                </div>

                {/* --- RIGHT COLUMN --- */}
                <Suspense fallback={<DetailsSkeleton />}>
                    <CardDetails cardId={cardId} />
                </Suspense>
            </div>
        </main>
    );
}

function DetailsSkeleton() {
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

function BreadcrumbSkeleton() {
    return (
        <div className='mb-6 flex h-5 items-center space-x-2'>
            <div className='h-4 w-5 rounded bg-muted' />
            <div className='h-4 w-4 rounded bg-muted' />
            <div className='h-4 w-28 rounded bg-muted' />
        </div>
    );
}
