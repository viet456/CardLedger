import { PrismaClient, Prisma } from '@prisma/client';
import { z } from 'zod';
import { findCardsInputSchema } from './pokemonCardValidator';

const prisma = new PrismaClient();
const BATCH_SIZE = 50;
export type FindCardsParams = z.infer<typeof findCardsInputSchema>;

// columns from the card table
type CardSortableField = keyof Prisma.CardOrderByWithRelationInput;

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
        weaknessType: weaknessTypeFilter,
        resistanceType: resistanceTypeFilter,
        ability: abilityFilter,
        rules,
        standard,
        expanded,
        unlimited
    } = params;

    const sortBy = (sortByInput as CardSortableField) || 'releaseDate';
    const sortOrder = sortOrderInput || 'desc';

    const whereClause: Prisma.CardWhereInput = {};

    //if (search) whereClause.name = { contains: search, mode:'insensitive' };
    // trigram fuzzy search via Gin index (not supported by Prisma)
    if (search) {
        const similarCardIds = await prisma.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "Card"
            WHERE name % ${search}
            ORDER BY similarity(name, ${search}) DESC
            LIMIT 2000
        `;
        const ids = similarCardIds.map((c) => c.id);
        // if no cards found, return empty results array
        if (ids.length === 0) {
            return { nextCursor: null, cards: [] };
        }
        whereClause.id = { in: ids };
    }

    if (setId) whereClause.setId = setId;
    if (releaseDate) whereClause.releaseDate = releaseDate;
    if (supertype) whereClause.supertype = supertype;
    if (rarity) whereClause.rarity = rarity;
    if (number) whereClause.number = number;
    if (artist) whereClause.artist = artist;
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

    // duplicates sorting for pagination
    const orderByClause: Prisma.CardOrderByWithRelationInput[] = [
        { [sortBy]: sortOrder },
        { id: 'asc' }
    ];

    const cards = await prisma.card.findMany({
        take: BATCH_SIZE,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        where: whereClause,
        orderBy: orderByClause
    });

    const lastCardInResults = cards.length === BATCH_SIZE ? cards[BATCH_SIZE - 1] : null;
    const nextCursor = lastCardInResults ? lastCardInResults.id : null;

    return {
        nextCursor,
        cards
    };
}
