import { prisma } from '@/src/lib/prisma';
import { notFound } from 'next/navigation';
import { SetPageView } from './SetPageView';
import { Metadata } from 'next';
import { getCachedSetData } from './data';
import { FilterOptions } from '@/src/shared-types/card-index';

export async function generateMetadata({
    params
}: {
    params: Promise<{ setId: string }>;
}): Promise<Metadata> {
    const { setId } = await params;
    const set = await prisma.set.findUnique({
        where: { id: setId }
    });

    if (!set) {
        return {
            title: 'Set Not Found | CardLedger'
        };
    }

    return {
        title: `${set.name} | CardLedger`,
        description: `Browse all ${set.printedTotal} cards from the ${set.name} set.`
    };
}

export async function generateStaticParams() {
    const sets = await prisma.set.findMany({
        select: {
            id: true
        }
    });
    return sets.map((set) => ({
        setId: set.id
    }));
}

export default async function SingleSetPage({ params }: { params: Promise<{ setId: string }> }) {
    const { setId } = await params;
    const data = await getCachedSetData(setId);
    if (!data) notFound();

    const filterOptions: FilterOptions = {
        artists: Array.from(
            new Set(data.cards.map((c) => c.artist).filter(Boolean))
        ).sort() as string[],
        rarities: Array.from(
            new Set(data.cards.map((c) => c.rarity).filter(Boolean))
        ).sort() as string[],
        types: Array.from(new Set(data.cards.flatMap((c) => c.types))).sort(),
        subtypes: Array.from(new Set(data.cards.flatMap((c) => c.subtypes))).sort(),
        weaknesses: Array.from(
            new Set(data.cards.flatMap((c) => c.weaknesses.map((w) => w.type)))
        ).sort(),
        resistances: Array.from(
            new Set(data.cards.flatMap((c) => c.resistances.map((r) => r.type)))
        ).sort()
    };
    return <SetPageView setInfo={data.setInfo} cards={data.cards} filterOptions={filterOptions} />;
}
