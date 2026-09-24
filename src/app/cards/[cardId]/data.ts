import { prisma } from '@/src/lib/prisma';
import { DenormalizedCard } from '@/src/shared-types/card-index';
import { PriceHistoryDataPoint } from '@/src/shared-types/price-api';
import { compareCardNumbers } from '@/src/utils/cardSort';
import { cacheTag, cacheLife } from 'next/cache';

export async function getCachedPriceHistory(cardId: string): Promise<PriceHistoryDataPoint[]> {
    'use cache';
    cacheTag('price-history');
    cacheLife('days');
    const history = await prisma.priceHistory.findMany({
        where: { cardId: cardId },
        orderBy: { timestamp: 'asc' },
        select: {
            timestamp: true,
            tcgNearMint: true,
            tcgNormal: true,
            tcgHolo: true,
            tcgReverse: true,
            tcgFirstEdition: true
        }
    });
    const dayMap = new Map<string, typeof history[0]>();
    for (const row of history) {
        const dayKey = row.timestamp.toISOString().split('T')[0];
        dayMap.set(dayKey, row);
    }
    
    return Array.from(dayMap.values()).map((row) => ({
        ...row,
        timestamp: row.timestamp.toISOString().split('T')[0],
        tcgNearMint: row.tcgNearMint ? Math.round(row.tcgNearMint.toNumber() * 100) / 100 : null,
        tcgNormal: row.tcgNormal ? Math.round(row.tcgNormal.toNumber() * 100) / 100 : null,
        tcgHolo: row.tcgHolo ? Math.round(row.tcgHolo.toNumber() * 100) / 100 : null,
        tcgReverse: row.tcgReverse ? Math.round(row.tcgReverse.toNumber() * 100) / 100 : null,
        tcgFirstEdition: row.tcgFirstEdition ? Math.round(row.tcgFirstEdition.toNumber() * 100) / 100 : null
    }));
}

async function getCardDataRaw(cardId: string): Promise<DenormalizedCard | null> {
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

    const denormalizedCard: DenormalizedCard = {
        id: rawCard.id,
        n: rawCard.name,
        hp: rawCard.hp,
        description: rawCard.description,
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
        price: null,
        hasNormal: rawCard.hasNormal,
        hasHolo: rawCard.hasHolo,
        hasReverse: rawCard.hasReverse,
        hasFirstEdition: rawCard.hasFirstEdition,
        tcgPlayerId: rawCard.tcgPlayerId ?? null
    };
    return denormalizedCard;
}

export async function getCachedCardData(cardId: string) {
    'use cache';
    cacheTag('card-data', 'card-details', `card-${cardId}`);
    cacheLife('max');

    return getCardDataRaw(cardId);
}

// ------------------------- Related cards (internal linking) -------------------------

export interface RelatedCardLink {
    id: string;
    name: string;
    number: string;
    imageKey: string | null;
    setId: string;
    setName: string;
}

export interface RelatedCardsData {
    cardName: string;
    evolvesFrom: RelatedCardLink | null;
    evolvesTo: RelatedCardLink[];
    prevInSet: RelatedCardLink | null;
    nextInSet: RelatedCardLink | null;
    sameSpecies: RelatedCardLink[];
}

const relatedCardSelect = {
    id: true,
    name: true,
    number: true,
    imageKey: true,
    set: { select: { id: true, name: true } }
} as const;

type RelatedCardRow = {
    id: string;
    name: string;
    number: string;
    imageKey: string | null;
    set: { id: string; name: string };
};

function toRelatedLink(card: RelatedCardRow): RelatedCardLink {
    return {
        id: card.id,
        name: card.name,
        number: card.number,
        imageKey: card.imageKey,
        setId: card.set.id,
        setName: card.set.name
    };
}

async function getRelatedCardsRaw(cardId: string): Promise<RelatedCardsData | null> {
    const card = await prisma.card.findUnique({
        where: { id: cardId },
        select: {
            ...relatedCardSelect,
            evolvesFrom: true,
            evolvesTo: true,
            nationalPokedexNumbers: true,
            setId: true
        }
    });
    if (!card) return null;

    // Prev / next within the set, in the locked 'num' order (cardSort.ts)
    const setMates = await prisma.card.findMany({
        where: { setId: card.setId },
        select: relatedCardSelect
    });
    const sortedMates = [...setMates].sort((a, b) => compareCardNumbers(a.number, b.number));
    const idx = sortedMates.findIndex((c) => c.id === cardId);
    const prevInSet = idx > 0 ? toRelatedLink(sortedMates[idx - 1]) : null;
    const nextInSet =
        idx >= 0 && idx < sortedMates.length - 1 ? toRelatedLink(sortedMates[idx + 1]) : null;

    // Evolution relatives — one representative printing (most recent) per species
    const evolutionNames = [card.evolvesFrom, ...card.evolvesTo].filter(
        (n): n is string => typeof n === 'string' && n.length > 0
    );
    const representatives = new Map<string, RelatedCardLink>();
    if (evolutionNames.length > 0) {
        const evolutionCards = await prisma.card.findMany({
            where: { name: { in: evolutionNames }, id: { not: cardId } },
            select: relatedCardSelect,
            orderBy: { set: { releaseDate: 'desc' } },
            take: 100
        });
        for (const c of evolutionCards) {
            if (!representatives.has(c.name)) representatives.set(c.name, toRelatedLink(c));
        }
    }
    const evolvesFrom = card.evolvesFrom ? (representatives.get(card.evolvesFrom) ?? null) : null;
    const evolvesTo = card.evolvesTo
        .map((n) => representatives.get(n))
        .filter((l): l is RelatedCardLink => !!l);

    // Other printings of the same species (national pokedex number match)
    let sameSpecies: RelatedCardLink[] = [];
    if (card.nationalPokedexNumbers.length > 0) {
        const speciesMates = await prisma.card.findMany({
            where: {
                id: { not: cardId },
                nationalPokedexNumbers: { hasSome: card.nationalPokedexNumbers }
            },
            select: relatedCardSelect,
            orderBy: { set: { releaseDate: 'desc' } },
            take: 6
        });
        sameSpecies = speciesMates.map(toRelatedLink);
    }

    return {
        cardName: card.name,
        evolvesFrom,
        evolvesTo,
        prevInSet,
        nextInSet,
        sameSpecies
    };
}

export async function getCachedRelatedCards(cardId: string): Promise<RelatedCardsData | null> {
    'use cache';
    cacheTag('card-data', 'card-related', `card-${cardId}`);
    cacheLife('max');

    return getRelatedCardsRaw(cardId);
}
