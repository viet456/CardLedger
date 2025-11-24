import { prisma } from '@/src/lib/prisma';
import { notFound } from 'next/navigation';
import { SetPageView } from './SetPageView';
import { DenormalizedCard, FilterOptions, SetObject } from '@/src/shared-types/card-index';
import { Metadata } from 'next';
import { mapPrismaCardToDenormalized } from '@/src/utils/cardMapper';

interface SetPageData {
    setInfo: SetObject;
    cards: DenormalizedCard[];
    filterOptions: FilterOptions;
}

export const revalidate = 86400; // 24 hrs

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

async function getSetData(setId: string): Promise<SetPageData | null> {
    const setWithCards = await prisma.set.findUnique({
        where: { id: setId },
        include: {
            cards: {
                orderBy: { number: 'asc' }, // Order cards by number
                include: {
                    artist: true,
                    rarity: true,
                    types: { include: { type: true } },
                    subtypes: { include: { subtype: true } },
                    weaknesses: { include: { type: true } },
                    resistances: { include: { type: true } },
                    abilities: true,
                    attacks: {
                        include: {
                            cost: {
                                include: {
                                    type: true
                                }
                            }
                        }
                    },
                    marketStats: true
                }
            }
        }
    });
    if (!setWithCards) return null;
    const setInfo: SetObject = {
        id: setWithCards.id,
        name: setWithCards.name,
        printedTotal: setWithCards.printedTotal,
        logoImageKey: setWithCards.logoImageKey,
        symbolImageKey: setWithCards.symbolImageKey,
        series: setWithCards.series,
        releaseDate: setWithCards.releaseDate.toISOString().split('T')[0],
        ptcgoCode: setWithCards.ptcgoCode
    };

    const denormalizedCards = setWithCards.cards.map((card) =>
        mapPrismaCardToDenormalized(card, setInfo)
    );

    const setArtists = new Set<string>();
    const setRarities = new Set<string>();
    const setTypes = new Set<string>();
    const setSubtypes = new Set<string>();
    const setWeaknesses = new Set<string>();
    const setResistances = new Set<string>();

    for (const card of denormalizedCards) {
        if (card.artist) setArtists.add(card.artist);
        if (card.rarity) setRarities.add(card.rarity);
        card.types.forEach((t) => setTypes.add(t));
        card.subtypes.forEach((s) => setSubtypes.add(s));
        card.weaknesses.forEach((w) => setWeaknesses.add(w.type));
        card.resistances.forEach((r) => setResistances.add(r.type));
    }

    const filterOptions: FilterOptions = {
        artists: Array.from(setArtists.keys()).sort(),
        rarities: Array.from(setRarities.keys()).sort(),
        types: Array.from(setTypes.keys()).sort(),
        subtypes: Array.from(setSubtypes.keys()).sort(),
        weaknesses: Array.from(setWeaknesses).sort(),
        resistances: Array.from(setResistances).sort()
    };

    return {
        setInfo,
        cards: denormalizedCards,
        filterOptions
    };
}

export default async function SingleSetPage({ params }: { params: { setId: string } }) {
    const data = await getSetData(params.setId);
    if (!data) notFound();
    return (
        <SetPageView setInfo={data.setInfo} cards={data.cards} filterOptions={data.filterOptions} />
    );
}
