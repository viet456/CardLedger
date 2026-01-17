import { prisma } from '@/src/lib/prisma';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { SingleCardView } from './SingleCardView';
import { PriceHistoryChart } from '@/src/components/cards/PriceHistoryChart';
import { getCachedCardData, getCachedPriceHistory } from './data';
import { Suspense } from 'react';

export async function generateMetadata({
    params
}: {
    params: Promise<{ cardId: string }>;
}): Promise<Metadata> {
    const { cardId } = await params;
    const card = await getCachedCardData(cardId);
    if (!card) {
        return {
            title: 'Card not found | CardLedger'
        };
    }
    const title = `${card.n} - ${card.set.name} (${card.n}/${card.set.printedTotal}) | CardLedger`;
    const description = `Details for the Pokémon card ${card.n} from the ${card.set.name} set.`;
    return {
        title: title,
        description: description
    };
}

export async function generateStaticParams() {
    const allCards = await prisma.card.findMany({
        select: {
            id: true,
            setId: true,
            releaseDate: true,
            number: true
        },
        // Sort by release date so our 'global' list is ready immediately
        orderBy: [
            {
                releaseDate: 'desc'
            }
        ]
    });
    // Generate 250 newest cards
    const idsToGenerate = new Set<string>();
    allCards.slice(0, 250).forEach((card) => {
        idsToGenerate.add(card.id);
    });

    // Select first 12 cards from each set
    const TARGET_NUMBERS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
    for (const card of allCards) {
        if (TARGET_NUMBERS.has(card.number)) {
            idsToGenerate.add(card.id);
        }
    }

    return Array.from(idsToGenerate).map((id) => ({
        id: id
    }));
}

export default async function SingleCardPage({ params }: { params: Promise<{ cardId: string }> }) {
    const { cardId } = await params;
    const [card, priceHistory] = await Promise.all([
        getCachedCardData(cardId),
        getCachedPriceHistory(cardId)
    ]);
    if (!card) {
        notFound();
    }
    return (
        <SingleCardView card={card}>
            <Suspense
                fallback={
                    <div className='animate-pulse'>
                        <div className='mb-4 flex gap-2'>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div
                                    key={i}
                                    className='h-9 flex-1 rounded bg-muted sm:w-12 sm:flex-none'
                                />
                            ))}
                        </div>

                        <div className='bg-muted/30 flex h-[300px] w-full items-center justify-center rounded-md'>
                            <span className='text-sm text-muted-foreground'>Loading chart...</span>
                        </div>
                    </div>
                }
            >
                <PriceHistoryChart initialData={priceHistory} />
            </Suspense>
        </SingleCardView>
    );
}
