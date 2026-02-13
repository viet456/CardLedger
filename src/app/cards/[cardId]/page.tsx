import { Suspense } from 'react';
import { CardImageDisplay } from './CardImageDisplay';
import { CardDetails } from './CardDetails';
import { CardBreadcrumbs } from './CardBreadcrumbs';
import { BreadcrumbSkeleton, DetailsSkeleton } from './Skeletons'; 

export default async function SingleCardPage({
    params,
    searchParams
}: {
    params: Promise<{ cardId: string }>;
    searchParams: Promise<{ preview?: string }>;
}) {
    const { cardId } = await params;
    const { preview } = await searchParams;
   const imagePath = preview 
        ? decodeURIComponent(preview) 
        : `cards/${cardId}`;
    return (
        <main className='container mx-auto max-w-6xl p-4 sm:p-6 lg:p-8'>
            <Suspense fallback={<BreadcrumbSkeleton />}>
                <CardBreadcrumbs cardId={cardId} />
            </Suspense>

            <div className='grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-12'>
                {/* --- LEFT COLUMN --- */}
                <div className='md:col-span-1'>
                    <CardImageDisplay 
                        img={imagePath} 
                        name='Card Image' 
                        id={cardId} 
                    />
                </div>

                {/* --- RIGHT COLUMN --- */}
                <Suspense fallback={<DetailsSkeleton />}>
                    <CardDetails cardId={cardId} />
                </Suspense>
            </div>
        </main>
    );
}