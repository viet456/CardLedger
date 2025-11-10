import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';
import { SetPageView } from './SetPageView';
import { DenormalizedCard, FilterOptions, SetObject } from '@/src/shared-types/card-index';
import { Metadata } from 'next';

const prisma = new PrismaClient();
export const revalidate = 86400;

export async function generateMetadata({
    params
}: {
    params: { setId: string };
}): Promise<Metadata> {
    const set = await prisma.set.findUnique({
        where: { id: params.setId }
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

async function getSetData(setId: string): Promise<SetObject | null> {
    const set = await prisma.set.findUnique({
        where: { id: setId },
        select: {
            id: true,
            name: true,
            printedTotal: true,
            logoImageKey: true,
            symbolImageKey: true,
            series: true,
            releaseDate: true,
            ptcgoCode: true
        }
    });
    if (!set) return null;
    return {
        ...set,
        releaseDate: set.releaseDate.toISOString().split('T')[0]
    };
}

export default async function SingleSetPage({ params }: { params: { setId: string } }) {
    const data = await getSetData(params.setId);
    if (!data) notFound();
    return <SetPageView setInfo={data} />;
}
