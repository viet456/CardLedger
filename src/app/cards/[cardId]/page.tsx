import { Suspense } from 'react';
import { CardImageDisplay } from './CardImageDisplay';
import { CardDetails } from './CardDetails';
import { CardBreadcrumbs } from './CardBreadcrumbs';
import { ClientCachedBreadcrumbFallback } from './ClientCachedBreadcrumbFallback';
import { ClientCachedDetailsFallback } from './ClientCachedDetailsFallback';
import { RelatedCards } from './RelatedCards';
import { PriceHero } from '@/src/components/cards/PriceHero';
import { Metadata } from 'next';
import { getCachedCardData, getCachedPriceHistory } from './data';
import { resolveBestNearMint } from '@/src/shared-types/price-api';
import { breadcrumbJsonLd, cardProductJsonLd } from '@/src/lib/jsonld';

export async function generateMetadata({
    params
}: {
    params: Promise<{ cardId: string }>;
}): Promise<Metadata> {
    const { cardId } = await params;
    const card = await getCachedCardData(cardId);

    if (!card) {
        return {
            title: 'Card Not Found',
            description: 'The requested card could not be found.'
        };
    }

    const cardName = card.n;
    const cardNumber = card.num;
    const setName = card.set.name;
    const title = `${cardName} #${cardNumber} (${setName})`;
    const description = `View ${cardName} #${cardNumber} from the ${setName} set. Track prices, check market trends, and add to your Pokémon TCG collection on CardLedger.`;

    return {
        title,
        description,
        alternates: {
            canonical: `/cards/${cardId}`
        },
        openGraph: {
            title,
            description,
            type: 'website'
        },
        twitter: {
            card: 'summary',
            title,
            description
        }
    };
}

export default async function SingleCardPage({ params }: {
    params: Promise<{ cardId: string }>;
}) {
    const { cardId } = await params;
    const card = await getCachedCardData(cardId);
    // Image key is derived server-side from cached card data — the old
    // ?preview param created duplicate parameterized URLs and is gone.
    // Falls back to the standard key pattern for cards without an image.
    const imagePath = card?.img ?? `cards/${cardId}`;

    // JSON-LD (schema.org): BreadcrumbList + Product/Offer
    const priceHistory = card ? await getCachedPriceHistory(cardId) : [];
    const latestPricePoint = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1] : null;
    const headlinePrice = latestPricePoint
        ? resolveBestNearMint(
              latestPricePoint.tcgNearMint,
              latestPricePoint.tcgNormal,
              latestPricePoint.tcgHolo,
              latestPricePoint.tcgReverse,
              latestPricePoint.tcgFirstEdition
          )
        : null;
    const productJsonLd = card
        ? cardProductJsonLd({
              id: card.id,
              name: card.n,
              number: card.num,
              setName: card.set.name,
              imageKey: card.img,
              description: card.description,
              releaseDate: card.set.releaseDate,
              price: headlinePrice
          })
        : null;
    const crumbs = card
        ? [
              { name: 'Home', url: '/' },
              { name: 'Sets', url: '/sets' },
              { name: card.set.name, url: `/sets/${card.set.id}` },
              { name: `${card.n} #${card.num}` }
          ]
        : [
              { name: 'Home', url: '/' },
              { name: 'Card Not Found' }
          ];

    return (
        <main className='container mx-auto max-w-6xl p-4 sm:p-6 lg:p-8'>
            <script
                type='application/ld+json'
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(crumbs)) }}
            />
            {productJsonLd && (
                <script
                    type='application/ld+json'
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
                />
            )}
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
                            <PriceHero cardId={cardId} />
                        </div>
                    </div>
                </div>

                {/* --- RIGHT COLUMN --- */}
                <div className='md:col-span-2'>
                    <Suspense fallback={<ClientCachedDetailsFallback cardId={cardId} />}>
                        <CardDetails cardId={cardId} />
                    </Suspense>

                    {/* Internal linking block (server-rendered, crawlable) */}
                    <div className='mt-8'>
                        <Suspense
                            fallback={
                                <div className='h-48 animate-pulse rounded-lg border bg-card shadow-sm' />
                            }
                        >
                            <RelatedCards cardId={cardId} />
                        </Suspense>
                    </div>
                </div>
            </div>
        </main>
    );
}
