import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { findCardsInputSchema } from './pokemonCardValidator';

const prisma = new PrismaClient();
const BATCH_SIZE = 50;
export type FindCardsParams = z.infer<typeof findCardsInputSchema>;

// columns from the card table
type CardSortableField = keyof Prisma.CardOrderByWithRelationInput;

export async function getFuzzyMatchedCardIds(search: string): Promise<string[]> {
    if (search.length < 2) {
        return [];
    }
    const results = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "Card"."id"
        FROM "Card"
        WHERE 
            -- exact id match
            "Card"."id" = ${search}
            -- prefix match on name
            OR "Card"."name" ILIKE ${search + '%'}
            -- fuzzy/typo search fallback
            OR word_similarity("Card"."name", ${search}) > 0.2
        ORDER BY 
            -- Priority: exact ID -> prefix name -> fuzzy similarity
            CASE
                WHEN "Card"."id" = ${search} THEN 0
                WHEN "Card"."name" ILIKE ${search + '%'} THEN 1
                ELSE 2
            END,
            word_similarity("Card"."name", ${search}) DESC
        LIMIT 200; -- Limit to a reasonable number for performance
    `;

    return results.map((r) => r.id);
}

export async function findPokemonCards(params: FindCardsParams) {
    const {
        cursor,
        sortBy: sortByInput,
        sortOrder: sortOrderInput,
        search,
        setId,
        releaseDate,
        supertype,
        rarity,
        number,
        hp_gte,
        hp_lte,
        artist,
        convertedRetreatCost_gte,
        convertedRetreatCost_lte,
        pokedexNumberSort,
        type: typeFilter,
        subtype: subtypeFilter,
        weakness: weaknessTypeFilter,
        resistance: resistanceTypeFilter,
        ability: abilityFilter,
        rules,
        standard,
        expanded,
        unlimited
    } = params;

    let matchedIds: string[] | undefined;
    const whereClause: Prisma.CardWhereInput = {};

    if (setId) whereClause.setId = setId;
    if (releaseDate) whereClause.releaseDate = releaseDate;
    if (supertype) whereClause.supertype = supertype;
    if (rarity) whereClause.rarity = { name: rarity };
    if (number) whereClause.number = number;
    if (artist) whereClause.artist = { name: artist };
    if (pokedexNumberSort) whereClause.pokedexNumberSort = pokedexNumberSort;
    if (rules) whereClause.rules = { has: rules };
    if (standard) whereClause.standard = standard;
    if (expanded) whereClause.expanded = expanded;
    if (unlimited) whereClause.unlimited = unlimited;

    if (hp_gte || hp_lte) {
        whereClause.hp = {};
        if (hp_gte) {
            whereClause.hp.gte = hp_gte;
        }
        if (hp_lte) {
            whereClause.hp.lte = hp_lte;
        }
    }

    if (convertedRetreatCost_gte || convertedRetreatCost_lte) {
        whereClause.convertedRetreatCost = {};
        if (convertedRetreatCost_gte) {
            whereClause.convertedRetreatCost.gte = convertedRetreatCost_gte;
        }
        if (convertedRetreatCost_lte) {
            whereClause.convertedRetreatCost.lte = convertedRetreatCost_lte;
        }
    }

    // relational filters (with "OR" logic for comma-separated values)
    if (typeFilter) {
        whereClause.types = { some: { type: { name: { in: typeFilter.split(',') } } } };
    }
    if (subtypeFilter) {
        whereClause.subtypes = { some: { subtype: { name: { in: subtypeFilter.split(',') } } } };
    }
    if (weaknessTypeFilter) {
        whereClause.weaknesses = {
            some: { type: { name: { in: weaknessTypeFilter.split(',') } } }
        };
    }
    if (resistanceTypeFilter) {
        whereClause.resistances = {
            some: { type: { name: { in: resistanceTypeFilter.split(',') } } }
        };
    }
    if (abilityFilter) {
        whereClause.abilities = {
            some: { name: { contains: abilityFilter, mode: 'insensitive' } }
        };
    }

    if (search) {
        matchedIds = await getFuzzyMatchedCardIds(search);
        if (matchedIds.length === 0) {
            return { nextCursor: null, cards: [], totalCount: 0 };
        }
        whereClause.id = { in: matchedIds };
    }

    // const orderByClause = sortByInput
    //     ? [{ [sortByInput as CardSortableField]: sortOrderInput || 'desc' }, { id: 'asc' }]
    //     : undefined;

    // const cards = await prisma.card.findMany({
    //     take: BATCH_SIZE,
    //     skip: cursor ? 1 : 0,
    //     cursor: cursor ? { id: cursor } : undefined,
    //     where: whereClause,
    //     orderBy: orderByClause
    // });
    // let finalCards = cards;

    // relevance sort - only query, no sort options selected
    if (search && matchedIds && !sortByInput) {
        const [cards, totalCount] = await prisma.$transaction([
            prisma.card.findMany({
                where: whereClause,
                include: {
                    set: true,
                    _count: true
                }
            }),
            prisma.card.count({ where: whereClause })
        ]);
        const cardMap = new Map(cards.map((card) => [card.id, card]));
        const orderedCards = matchedIds
            .map((id) => cardMap.get(id))
            .filter(Boolean) as typeof cards;

        const startIndex = cursor ? orderedCards.findIndex((c) => c.id === cursor) + 1 : 0;
        const paginatedCards = orderedCards.slice(startIndex, startIndex + BATCH_SIZE);

        const lastCardInResults =
            paginatedCards.length === BATCH_SIZE ? paginatedCards[paginatedCards.length - 1] : null;
        const nextCursor = lastCardInResults ? lastCardInResults.id : null;

        return {
            nextCursor,
            cards: paginatedCards,
            totalCount // card return count
        };
    } else {
        const orderByClause: Prisma.CardOrderByWithRelationInput[] = [];
        if (sortByInput) {
            orderByClause.push({ [sortByInput]: sortOrderInput || 'desc' });
        } else {
            orderByClause.push({ releaseDate: 'desc' });
        }
        orderByClause.push({ id: 'asc' });
        // const orderByClause = sortByInput
        //     ? [{ [sortByInput as CardSortableField]: sortOrderInput || 'desc' }, { id: 'asc' }]
        //     : [{ releaseDate: 'desc' }, { id: 'asc' }]; // Default sort
        const [cards, totalCount] = await prisma.$transaction([
            prisma.card.findMany({
                take: BATCH_SIZE,
                skip: cursor ? 1 : 0,
                cursor: cursor ? { id: cursor } : undefined,
                where: whereClause,
                orderBy: orderByClause,
                include: {
                    set: true
                }
            }),
            prisma.card.count({ where: whereClause })
        ]);
        const lastCardInResults = cards.length === BATCH_SIZE ? cards[cards.length - 1] : null;
        const nextCursor = lastCardInResults ? lastCardInResults.id : null;

        return {
            nextCursor,
            cards,
            totalCount // card return count
        };
    }
}
