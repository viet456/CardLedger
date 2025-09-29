import { publicProcedure, router } from '../trpc';
import { findCardsInputSchema } from '@/src/services/pokemonCardValidator';
import { findPokemonCards } from '@/src/services/pokemonCardService';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
            if (!input.search) {
                return []; // return empty array if search is empty
            }
            const similarCards = await prisma.$queryRaw<
                Array<{ id: string; name: string; setName: string }>
            >`
                SELECT 
                    "Card"."id", 
                    "Card"."name", 
                    "Set"."name" as "setName"
                FROM "Card"
                JOIN "Set" ON "Card"."setId" = "Set"."id"
                WHERE "Card"."name" % ${input.search}
                ORDER BY similarity("Card"."name", ${input.search}) DESC
                LIMIT 5
            `;
            return similarCards;
        })
});
