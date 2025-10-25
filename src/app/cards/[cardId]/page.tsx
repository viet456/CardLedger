import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { DenormalizedCard, SetObject } from '@/src/shared-types/card-index';
import { SingleCardView } from './SingleCardView';

const prisma = new PrismaClient();

export const revalidate = 86400;

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

async function getCardData(cardId: string): Promise<DenormalizedCard | null> {
    const rawCard = await prisma.card.findUnique({
        where: { id: cardId },
        include: {
            set: true,
            artist: true,
            rarity: true,
            subtypes: { include: { subtype: true } },
            types: { include: { type: true } },
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
    });
    if (!rawCard) return null;

    // Convert R2 key to Cloudinary
    const transformImageKey = (imageKey: string | null): string | null => {
        if (!imageKey) return null;
        const baseId = imageKey.replace('cards/', '').replace(/\.[^/.]+$/, '');
        return `home/${baseId}`;
    };

    const denormalizedCard: DenormalizedCard = {
        id: rawCard.id,
        n: rawCard.name,
        hp: rawCard.hp,
        num: rawCard.number,
        img: transformImageKey(rawCard.imageKey),
        pS: rawCard.pokedexNumberSort,
        cRC: rawCard.convertedRetreatCost,
        artist: rawCard.artist?.name || null,
        rarity: rawCard.rarity?.name || null,
        set: {
            ...rawCard.set,
            releaseDate: rawCard.set.releaseDate.toISOString().split('T')[0]
        },
        supertype: rawCard.supertype,
        types: rawCard.types.map((t) => t.type.name),
        evolvesFrom: rawCard.evolvesFrom,
        evolvesTo: rawCard.evolvesTo,
        subtypes: rawCard.subtypes.map((s) => s.subtype.name),
        weaknesses: rawCard.weaknesses.map((w) => ({
            type: w.type.name,
            value: w.value || null
        })),
        resistances: rawCard.resistances.map((r) => ({
            type: r.type.name,
            value: r.value || null
        })),
        abilities: rawCard.abilities.map((ability) => ({
            name: ability.name,
            text: ability.text,
            type: ability.type
        })),
        rules: rawCard.rules,
        attacks: rawCard.attacks.map((attack) => ({
            name: attack.name,
            cost: attack.cost.map((c) => c.type.name),
            damage: attack.damage || null,
            text: attack.text || null
        })),
        legalities: {
            standard: rawCard.standard,
            expanded: rawCard.expanded,
            unlimited: rawCard.unlimited
        },
        pokedexNumbers: rawCard.nationalPokedexNumbers,
        ancientTrait:
            rawCard.ancientTraitName && rawCard.ancientTraitText
                ? { name: rawCard.ancientTraitName, text: rawCard.ancientTraitText }
                : null
    };
    return denormalizedCard;
}

export default async function SingleCardPage({ params }: { params: { cardId: string } }) {
    const card = await getCardData(params.cardId);
    if (!card) notFound();
    return <SingleCardView card={card} />;
}
