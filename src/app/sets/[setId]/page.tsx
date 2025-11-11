import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';
import { SetPageView } from './SetPageView';
import { DenormalizedCard, FilterOptions, SetObject } from '@/src/shared-types/card-index';
import { Metadata } from 'next';
import { AbilityObject } from '@/src/shared-types/card-index';
interface SetPageData {
    setInfo: SetObject;
    cards: DenormalizedCard[];
    filterOptions: FilterOptions;
}

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
                    }
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

    const denormalizedCards: DenormalizedCard[] = [];
    const setArtists = new Map<string, string>();
    const setRarities = new Map<string, string>();
    const setTypes = new Map<string, string>();
    const setSubtypes = new Map<string, string>();

    for (const card of setWithCards.cards) {
        // Build filter options
        if (card.artist) setArtists.set(card.artist.name, card.artist.name);
        if (card.rarity) setRarities.set(card.rarity.name, card.rarity.name);
        card.types.forEach((t) => setTypes.set(t.type.name, t.type.name));
        card.subtypes.forEach((s) => setSubtypes.set(s.subtype.name, s.subtype.name));

        // Build denormalized card object
        const denormalizedCard: DenormalizedCard = {
            id: card.id,
            n: card.name,
            hp: card.hp,
            num: card.number,
            img: card.imageKey,
            pS: card.pokedexNumberSort,
            cRC: card.convertedRetreatCost,
            artist: card.artist?.name || null,
            rarity: card.rarity?.name || null,
            set: setInfo,
            supertype: card.supertype,
            subtypes: card.subtypes.map((s) => s.subtype.name),
            types: card.types.map((t) => t.type.name),
            weaknesses: card.weaknesses.map((w) => ({ type: w.type.name, value: w.value })),
            resistances: card.resistances.map((r) => ({ type: r.type.name, value: r.value })),
            abilities: card.abilities as AbilityObject[],
            // Re-map attacks to include cost as string[]
            attacks: card.attacks.map((attack) => ({
                name: attack.name,
                cost: attack.cost.map((c) => c.type.name),
                damage: attack.damage,
                text: attack.text
            })),
            rules: card.rules,
            evolvesFrom: card.evolvesFrom,
            evolvesTo: card.evolvesTo,
            legalities: {
                standard: card.standard,
                expanded: card.expanded,
                unlimited: card.unlimited
            },
            pokedexNumbers: card.nationalPokedexNumbers,
            ancientTrait: card.ancientTraitName
                ? { name: card.ancientTraitName, text: card.ancientTraitText || '' }
                : null,
            price: null // Server doesn't know price; client will add this
        };
        denormalizedCards.push(denormalizedCard);
    }

    const filterOptions: FilterOptions = {
        artists: Array.from(setArtists.keys()).sort(),
        rarities: Array.from(setRarities.keys()).sort(),
        types: Array.from(setTypes.keys()).sort(),
        subtypes: Array.from(setSubtypes.keys()).sort()
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
