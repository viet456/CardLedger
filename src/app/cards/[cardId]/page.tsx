import { notFound } from 'next/navigation';
import { CardImageDisplay } from './CardImageDisplay';
import { CardDetails } from './CardDetails';
import { CardBreadcrumbs } from './CardBreadcrumbs';
import { RelatedCards } from './RelatedCards';
import { PriceHero } from '@/src/components/cards/PriceHero';
import { Metadata } from 'next';
import { getCachedCardData } from './data';
import { breadcrumbJsonLd, cardProductJsonLd } from '@/src/lib/jsonld';
import { prisma } from '@/src/lib/prisma';

export const ensureStatic = 'navigation';

export async function generateStaticParams() {
    // Prerender a small seed set so Next.js validates static output at build
    // time and enables per-URL on-demand ISR caching for all remaining ~22k cards.
    const cards = await prisma.card.findMany({
        select: { id: true },
        orderBy: { releaseDate: 'desc' },
        take: 24
    });
    return cards.map((c) => ({ cardId: c.id }));
}

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
            canonical: `/cards/${encodeURIComponent(cardId)}`
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

export default async function SingleCardPage({ params }: { params: Promise<{ cardId: string }> }) {
    const { cardId } = await params;
    const card = await getCachedCardData(cardId);
    if (!card) notFound();

    // Image key is derived server-side from cached card data — the old
    // ?preview param created duplicate parameterized URLs and is gone.
    // Falls back to the standard key pattern for cards without an image.
    const imagePath = card.img ?? `cards/${cardId}`;

    // JSON-LD (schema.org): BreadcrumbList + Product/Offer
    // Uses the 1-to-1 MarketStats headline price cached on `card.price`
    // (cacheLife('weeks')) instead of scanning all PriceHistory rows.
    const productJsonLd = cardProductJsonLd({
        id: card.id,
        name: card.n,
        number: card.num,
        setName: card.set.name,
        imageKey: card.img,
        description: card.description,
        releaseDate: card.set.releaseDate,
        price: card.price
    });
    const crumbs = [
        { name: 'Home', url: '/' },
        { name: 'Sets', url: '/sets' },
        { name: card.set.name, url: `/sets/${card.set.id}` },
        { name: `${card.n} #${card.num}` }
    ];

    return (
        <main className='container mx-auto max-w-6xl p-4 sm:p-6 lg:p-8'>
            <script
                type='application/ld+json'
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(crumbs)) }}
            />
            <script
                type='application/ld+json'
                dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
            />
            <CardBreadcrumbs card={card} />

            <div className='grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-12'>
                {/* --- LEFT COLUMN: Sticky on Desktop --- */}
                <div className='md:col-span-1'>
                    <div className='flex flex-col gap-4 md:sticky md:top-20'>
                        <CardImageDisplay img={imagePath} name={card.n} id={cardId} />

                        {/* Desktop-only PriceHero */}
                        <div className='hidden px-2 md:block'>
                            <PriceHero
                                cardId={cardId}
                                initialPrice={card.price}
                                cardName={card.n}
                                setName={card.set.name}
                                tcgPlayerId={card.tcgPlayerId}
                            />
                        </div>
                    </div>
                </div>

                {/* --- RIGHT COLUMN --- */}
                <div className='md:col-span-2'>
                    <CardDetails card={card} />

                    {/* Internal linking block (server-rendered, crawlable) */}
                    <div className='mt-8'>
                        <RelatedCards cardId={cardId} />
                    </div>
                </div>
            </div>
        </main>
    );
}
