import { prisma } from '@/src/lib/prisma';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { SingleCardView } from './SingleCardView';
import { PriceHistoryChart } from '@/src/components/cards/PriceHistoryChart';
import { getCachedCardData, getCachedPriceHistory } from './data';

export const revalidate = 86400; // Daily

export async function generateMetadata({
    params
}: {
    params: { cardId: string };
}): Promise<Metadata> {
    const card = await prisma.card.findUnique({
        where: { id: params.cardId },
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

export default async function SingleCardPage({ params }: { params: { cardId: string } }) {
    const [card, priceHistory] = await Promise.all([
        getCachedCardData(params.cardId),
        getCachedPriceHistory(params.cardId)
    ]);
    if (!card) {
        notFound();
    }
    return (
        <SingleCardView card={card}>
            <PriceHistoryChart initialData={priceHistory} />
        </SingleCardView>
    );
}
