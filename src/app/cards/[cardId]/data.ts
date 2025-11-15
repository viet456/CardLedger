import { PrismaClient } from '@prisma/client';
import { DenormalizedCard } from '@/src/shared-types/card-index';
import { PriceHistoryDataPoint } from '@/src/shared-types/price-api';

const prisma = new PrismaClient();

export async function getPriceHistory(cardId: string): Promise<PriceHistoryDataPoint[]> {
    const history = await prisma.priceHistory.findMany({
        where: { cardId: cardId },
        orderBy: { timestamp: 'asc' },
        select: {
            timestamp: true,
            tcgNearMint: true,
            tcgLightlyPlayed: true,
            tcgModeratelyPlayed: true,
            tcgHeavilyPlayed: true,
            tcgDamaged: true
        }
    });
    return history.map((row) => ({
        ...row,
        timestamp: row.timestamp.toISOString().split('T')[0],
        tcgNearMint: row.tcgNearMint?.toNumber() ?? null,
        tcgLightlyPlayed: row.tcgLightlyPlayed?.toNumber() ?? null,
        tcgModeratelyPlayed: row.tcgModeratelyPlayed?.toNumber() ?? null,
        tcgHeavilyPlayed: row.tcgHeavilyPlayed?.toNumber() ?? null,
        tcgDamaged: row.tcgDamaged?.toNumber() ?? null
    }));
}

export async function getCardData(cardId: string): Promise<DenormalizedCard | null> {
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
            },
            marketStats: true
        }
    });
    if (!rawCard) return null;

    const denormalizedCard: DenormalizedCard = {
        id: rawCard.id,
        n: rawCard.name,
        hp: rawCard.hp,
        num: rawCard.number,
        img: rawCard.imageKey,
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
                : null,
        price: rawCard.marketStats?.tcgNearMintLatest?.toNumber() ?? null
    };
    return denormalizedCard;
}
