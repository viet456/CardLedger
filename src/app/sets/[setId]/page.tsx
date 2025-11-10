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

async function getSetData(setId: string) {
    const setWithCardsRaw = await prisma.set.findUnique({
        where: { id: setId },
        include: {
            cards: {
                include: {
                    types: { include: { type: true } },
                    subtypes: { include: { subtype: true } },
                    artist: true,
                    rarity: true,
                    weaknesses: { include: { type: true } },
                    resistances: { include: { type: true } },
                    abilities: true,
                    attacks: {
                        include: {
                            cost: {
                                include: { type: true }
                            }
                        }
                    }
                }
            }
        }
    });
    if (!setWithCardsRaw) return null;
    setWithCardsRaw.cards.sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true })
    );

    // Cards' current market prices
    const cardIds = setWithCardsRaw.cards.map((card) => card.id);
    const priceData = await prisma.marketStats.findMany({
        where: { cardId: { in: cardIds } },
        select: {
            cardId: true,
            tcgNearMintLatest: true
        }
    });
    const priceMap = new Map(priceData.map((p) => [p.cardId, p.tcgNearMintLatest]));

    // Helper functions for transformations
    const setInfo: SetObject = {
        ...setWithCardsRaw,
        releaseDate: setWithCardsRaw.releaseDate.toISOString().split('T')[0]
    };
    const cards: DenormalizedCard[] = setWithCardsRaw.cards.map((card) => ({
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
        evolvesFrom: card.evolvesFrom || null,
        evolvesTo: card.evolvesTo,
        types: card.types.map((t) => t.type.name),
        subtypes: card.subtypes.map((s) => s.subtype.name),
        weaknesses: card.weaknesses.map((w) => ({
            type: w.type.name,
            value: w.value || null
        })),
        resistances: card.resistances.map((r) => ({
            type: r.type.name,
            value: r.value || null
        })),
        abilities: card.abilities.map((ability) => ({
            name: ability.name,
            text: ability.text,
            type: ability.type
        })),
        rules: card.rules,
        attacks: card.attacks.map((attack) => ({
            name: attack.name,
            cost: attack.cost.map((c) => c.type.name),
            damage: attack.damage || null,
            text: attack.text || null
        })),
        legalities: {
            standard: card.standard,
            expanded: card.expanded,
            unlimited: card.unlimited
        },
        pokedexNumbers: card.nationalPokedexNumbers,
        ancientTrait:
            card.ancientTraitName && card.ancientTraitText
                ? { name: card.ancientTraitName, text: card.ancientTraitText }
                : null,
        price: priceMap.get(card.id)?.toNumber() ?? null
    }));
    const filterOptions: FilterOptions = {
        rarities: await prisma.rarity.findMany(),
        types: await prisma.type.findMany(),
        subtypes: await prisma.subtype.findMany(),
        artists: await prisma.artist.findMany()
    };
    return { setInfo, cards, filterOptions };
}

export default async function SingleSetPage({ params }: { params: { setId: string } }) {
    const data = await getSetData(params.setId);
    if (!data) notFound();
    return (
        <SetPageView setInfo={data.setInfo} cards={data.cards} filterOptions={data.filterOptions} />
    );
}
