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
    const card = await prisma.card.findUnique({
        where: { id: cardId },
        include: {
            set: true
        }
    });
    if (!card) {
        return {
            title: 'Card not found | CardLedger'
        };
    }
    const title = `${card.name} - ${card.set.name} (${card.number}/${card.set.printedTotal}) | CardLedger`;
    const description = `Details for the Pokémon card ${card.name} from the ${card.set.name} set.`;
    return {
        title: title,
        description: description
    };
}

export async function generateStaticParams() {
    const cards = await prisma.card.findMany({
        orderBy: { releaseDate: 'desc' },
        take: 200,
        select: {
            id: true
        }
    });
    return cards.map((card) => ({
        cardId: card.id
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
