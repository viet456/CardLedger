import { Suspense } from 'react';
import { CardImageDisplay } from './CardImageDisplay';
import { CardDetails } from './CardDetails';
import { CardBreadcrumbs } from './CardBreadcrumbs';
import { ClientCachedBreadcrumbFallback } from './ClientCachedBreadcrumbFallback';
import { ClientCachedDetailsFallback } from './ClientCachedDetailsFallback';
import { PriceHero } from '@/src/components/cards/PriceHero';
import { Metadata } from 'next';
import { getCachedCardData } from './data';

export async function generateMetadata({
    params
}: {
    params: Promise<{ cardId: string }>;
}): Promise<Metadata> {
    const { cardId } = await params;
    const card = await getCachedCardData(cardId);

    if (!card) {
        return {
            title: 'Card Not Found | CardLedger',
            description: 'The requested card could not be found.'
        };
    }

    const cardName = card.n;
    const cardNumber = card.num;
    const setName = card.set.name;
    const title = `${cardName} #${cardNumber} (${setName}) | CardLedger`;
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

export default async function SingleCardPage({ params, searchParams }: {
    params: Promise<{ cardId: string }>;
    searchParams: Promise<{ preview?: string }>;
}) {
    const { cardId } = await params;
    const { preview } = await searchParams;
    const imagePath = preview ? decodeURIComponent(preview) : `cards/${cardId}`;

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
                            <PriceHero cardId={cardId} />
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
