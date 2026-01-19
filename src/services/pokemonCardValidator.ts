import { z } from 'zod';
import { Supertype, LegalityStatus } from '@prisma/client';

// set what fields should be sortable
const sortableKeys = z.enum([
    'n',
    'rD',
    'pS',
    'num',
    'price',
    'relevance',
    'cost',
    'acquired',
    'gain'
]);
export type SortableKey = z.infer<typeof sortableKeys>;
export type FilterState = z.infer<typeof findCardsInputSchema>;

// the shape of card requests
export const findCardsInputSchema = z.object({
    // Pagination & Sorting
    cursor: z.string().nullish(),
    sortBy: sortableKeys.optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    hp_gte: z.coerce.number().optional(), // Greater than or equal to
    hp_lte: z.coerce.number().optional(), // Less than or equal to
    convertedRetreatCost_gte: z.coerce.number().optional(),
    convertedRetreatCost_lte: z.coerce.number().optional(),
    number: z.string().optional(),
    pokedexNumberSort: z.coerce.number().optional(),
    releaseDate: z.coerce.date().optional(),

    // Filters from the Card model
    search: z.string().optional(),
    rarity: z.string().optional(),
    artist: z.string().optional(),
    setId: z.string().optional(),
    rules: z.string().optional(),
    weakness: z.string().optional(),
    resistance: z.string().optional(),

    // Relational Filters
    supertype: z.nativeEnum(Supertype).optional(),
    type: z.string().optional(),
    subtype: z.string().optional(),
    ability: z.string().optional(),
    standard: z.nativeEnum(LegalityStatus).optional(),
    expanded: z.nativeEnum(LegalityStatus).optional(),
    unlimited: z.nativeEnum(LegalityStatus).optional()
});
