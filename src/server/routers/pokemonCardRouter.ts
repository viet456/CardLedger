import { publicProcedure, router } from '../trpc';
import { findCardsInputSchema } from '@/src/services/pokemonCardValidator';
import { findPokemonCards } from '@/src/services/pokemonCardService';
import { startsWith, z } from 'zod';
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
            if (input.search.length < 2) {
                return []; // return empty array if search is empty
            }
            // exact id matching
            const exactMatch = await prisma.card.findUnique({
                where: { id: input.search },
                include: {
                    set: {
                        select: { name: true, printedTotal: true, id: true }
                    }
                }
            });
            if (exactMatch) {
                return [
                    {
                        id: exactMatch.id,
                        name: exactMatch.name,
                        setName: exactMatch.set.name,
                        setId: exactMatch.set.id,
                        number: exactMatch.number,
                        printedTotal: exactMatch.set.printedTotal
                    }
                ];
            }
            // fuzzy search by name
            const similarCards = await prisma.$queryRaw<
                Array<{
                    id: string;
                    name: string;
                    setName: string;
                    setId: string;
                    number: string;
                    printedTotal: number;
                }>
            >`
                SELECT 
                    "Card"."id", 
                    "Card"."name", 
                    "Set"."name" as "setName",
                    "Set"."id" as "setId",
                    "Card"."number",
                    "Set"."printedTotal"
                FROM "Card"
                JOIN "Set" ON "Card"."setId" = "Set"."id"
                WHERE 
                    -- exact id match
                    "Card"."id" = ${input.search}
                    -- prefix match
                    OR "Card"."name" ILIKE ${input.search + '%'}
                    -- fuzzy/typo search fallback
                    OR word_similarity("Card"."name", ${input.search}) > 0.2
                ORDER BY 
                    -- priority: exact -> prefix -> fuzzy
                    CASE
                        WHEN "Card"."id" = ${input.search} THEN 0
                        WHEN "Card"."name" ILIKE ${input.search + '%'} THEN 1
                        ELSE 2
                    END,
                    word_similarity("Card"."name", ${input.search}) DESC
                LIMIT 5
            `;
            return similarCards;
        })
    // getIdSuggestions: publicProcedure
    //     .input(z.object({ search: z.string() }))
    //     .query(async ({ input }) => {
    //         if (input.search.length < 2) {
    //             return [];
    //         }

    //         const idMatches = await prisma.card.findMany({
    //             where: { id: { startsWith: input.search } },
    //             take: 3,
    //             include: {
    //                 set: {
    //                     select: {
    //                         name: true, printedTotal: true,
    //                     }
    //                 }
    //             }
    //         });

    //         return idMatches.map(card => ({
    //             id: card.id,
    //             name: card.name,
    //             setName: card.set.name,
    //             number: card.number,
    //             printedTotal: card.set.printedTotal,
    //         }))
    //     }),
});
