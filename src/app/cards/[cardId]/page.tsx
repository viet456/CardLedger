import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { SingleCardView } from './SingleCardView';
import { PriceHistoryChart } from '@/src/components/cards/PriceHistoryChart';

const prisma = new PrismaClient();

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

async function getPageData(cardId: string) {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/cards/${cardId}`, {
        cache: 'no-store',
        next: {
            tags: ['card-data', `card-${cardId}`]
        }
    });
    if (!response.ok) {
        return null;
    }
    return response.json();
}

export default async function SingleCardPage({ params }: { params: { cardId: string } }) {
    const data = await getPageData(params.cardId);
    if (!data) {
        notFound();
    }
    const { card, priceHistory } = data;
    return (
        <SingleCardView card={card}>
            <PriceHistoryChart initialData={priceHistory} />
        </SingleCardView>
    );
}
