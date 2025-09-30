import { publicProcedure, router } from '../trpc';
import { findCardsInputSchema } from '@/src/services/pokemonCardValidator';
import { findPokemonCards, getFuzzyMatchedCardIds } from '@/src/services/pokemonCardService';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const cardForSuggestionSchema = z.object({
    id: z.string(),
    name: z.string(),
    number: z.string(),
    set: z.object({
        name: z.string(),
        printedTotal: z.number(),
        id: z.string()
    })
});
type CardForSuggestion = z.infer<typeof cardForSuggestionSchema>;

// imports validator and service to create an api procedure/endpoint
export const pokemonCardRouter = router({
    findMany: publicProcedure.input(findCardsInputSchema).query(async ({ input }) => {
        // calls on service with the validated input
        const result = await findPokemonCards(input);
        return result;
    }),
    getSuggestions: publicProcedure
        .input(z.object({ search: z.string() }))
        .query(async ({ input }) => {
            if (input.search.length < 2) {
                return []; // return empty array if search is empty
            }
            const matchedIds = await getFuzzyMatchedCardIds(input.search);
            if (matchedIds.length === 0) {
                return [];
            }

            // fuzzy search
            const cards = await prisma.card.findMany({
                where: { id: { in: matchedIds.slice(0, 5) } },
                select: {
                    // redundant^^^, but precision selection is efficient
                    id: true,
                    name: true,
                    number: true,
                    set: {
                        select: { name: true, printedTotal: true, id: true }
                    }
                }
            });
            const cardMap = new Map(cards.map((card) => [card.id, card]));
            const orderedCards = matchedIds
                .slice(0, 5)
                .map((id) => cardMap.get(id))
                .filter((card): card is CardForSuggestion => card !== undefined);
            return orderedCards.map((card) => ({
                id: card.id,
                name: card.name,
                setName: card.set.name,
                setId: card.set.id,
                number: card.number,
                printedTotal: card.set.printedTotal
            }));
        }),
    searchCards: publicProcedure.input(findCardsInputSchema).query(async ({ input }) => {
        return findPokemonCards(input);
    })
});
