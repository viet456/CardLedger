import { z } from 'zod';
import { Supertype, LegalityStatus } from '@prisma/client';

const SortableFields = z.enum(['name', 'releaseDate', 'pokedexNumberSort', 'number']);

// the shape of card requests
export const findCardsInputSchema = z.object({
    // Pagination & Sorting
    cursor: z.string().nullish(),
    sortBy: SortableFields.nullish(),
    sortOrder: z.enum(['asc', 'desc']).nullish(),
    hp_gte: z.coerce.number().optional(), // Greater than or equal to
    hp_lte: z.coerce.number().optional(), // Less than or equal to
    convertedRetreatCost_gte: z.number().optional(),
    convertedRetreatCost_lte: z.number().optional(),
    number: z.string().optional(),
    pokedexNumberSort: z.number().optional(),
    releaseDate: z.date().optional(),

    // Filters from the Card model
    search: z.string().optional(),
    rarity: z.string().optional(),
    artist: z.string().optional(),
    setId: z.string().optional(),
    rules: z.string().optional(),

    // Relational Filters
    supertype: z.nativeEnum(Supertype).optional(),
    type: z.string().optional(),
    subtype: z.string().optional(),
    weaknessType: z.string().optional(),
    resistanceType: z.string().optional(),
    ability: z.string().optional(),
    standard: z.nativeEnum(LegalityStatus).optional(),
    expanded: z.nativeEnum(LegalityStatus).optional(),
    unlimited: z.nativeEnum(LegalityStatus).optional()
});
