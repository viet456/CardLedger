import { Suspense } from 'react';
import { CardImageDisplay } from './CardImageDisplay';
import { CardDetails } from './CardDetails';
import { CardBreadcrumbs } from './CardBreadcrumbs';
import { ClientCachedBreadcrumbFallback } from './ClientCachedBreadcrumbFallback';
import { ClientCachedDetailsFallback } from './ClientCachedDetailsFallback';
import { PriceHero } from '@/src/components/cards/PriceHero';
import { getCachedCardData } from './data';
import { getTcgPlayerUrl } from '@/src/utils/tcgplayer';

// src/app/cards/[cardId]/page.tsx

export default async function SingleCardPage({ params, searchParams }: {
    params: Promise<{ cardId: string }>;
    searchParams: Promise<{ preview?: string }>;
}) {
    const { cardId } = await params;
    const { preview } = await searchParams;
    const imagePath = preview ? decodeURIComponent(preview) : `cards/${cardId}`;

    // Fetch card data server-side for TCGplayer URL (SEO-friendly)
    const card = await getCachedCardData(cardId);
    const tcgPlayerUrl = getTcgPlayerUrl(
        card?.tcgPlayerId ?? null,
        card?.n ?? 'Pokemon Card',
        card?.set?.name
    );

    return (
        <main className='container mx-auto max-w-6xl p-4 sm:p-6 lg:p-8'>
            <Suspense fallback={<ClientCachedBreadcrumbFallback cardId={cardId} />}>
                <CardBreadcrumbs cardId={cardId} />
            </Suspense>

            <div className='grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-12'>
                {/* --- LEFT COLUMN: Sticky on Desktop --- */}
                <div className='md:col-span-1'>
                    <div className='md:sticky md:top-20 flex flex-col gap-4'>
                        <CardImageDisplay img={imagePath} name='Card Image' id={cardId} />
                        
                        {/* Desktop-only PriceHero */}
                        <div className='hidden md:block px-2'> 
                            <PriceHero cardId={cardId} tcgPlayerUrl={tcgPlayerUrl} />
                        </div>
                    </div>
                </div>

                {/* --- RIGHT COLUMN --- */}
                <div className='md:col-span-2'>
                    <Suspense fallback={<ClientCachedDetailsFallback cardId={cardId} />}>
                        <CardDetails cardId={cardId} />
                    </Suspense>
                </div>
            </div>
        </main>
    );
}
