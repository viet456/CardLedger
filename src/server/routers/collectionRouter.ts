import { publicProcedure, router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/src/lib/prisma';
import { CardCondition } from '@prisma/client';
import { getPortfolioValue } from '@/src/services/portfolioService';

const CardConditionValues = Object.values(CardCondition) as [string, ...string[]];

export const collectionRouter = router({
    /**
     * Gets all collection entries for a specific user.
     * This is public, so anyone can view a collection (eg for public profiles).
     */
    getCollection: publicProcedure
        .input(z.object({ userId: z.string().optional() }).optional())
        .query(async ({ input, ctx }) => {
            const targetUserId = input?.userId ?? ctx.user?.id;
            if (!targetUserId) {
                return { entries: [], lastModified: Date.now() };
            }
            const entries = await prisma.collectionEntry.findMany({
                where: { userId: targetUserId },
                include: {
                    card: {
                        include: {
                            set: true,
                            rarity: true,
                            marketStats: true,
                            artist: true,
                            types: { include: { type: true } },
                            subtypes: { include: { subtype: true } },
                            weaknesses: { include: { type: true } },
                            resistances: { include: { type: true } }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            const lastModified =
                entries.length > 0
                    ? Math.max(...entries.map((e) => e.createdAt.getTime()))
                    : Date.now();

            return { entries, lastModified };
        }),
    /**
     * Adds a new card to a *logged-in* user's collection.
     * This is a protected procedure; it will fail if the user is not authenticated.
     */
    addToCollection: protectedProcedure
        .input(
            z.object({
                cardId: z.string(),
                purchasePrice: z.number(),
                condition: z.enum(CardConditionValues)
            })
        )
        .mutation(async ({ input, ctx }) => {
            const { cardId, purchasePrice, condition } = input;
            const userId = ctx.user.id;
            const newEntry = await prisma.collectionEntry.create({
                data: {
                    userId,
                    cardId,
                    purchasePrice,
                    condition: condition as CardCondition
                    //variantName
                },
                include: {
                    card: {
                        include: {
                            set: true,
                            rarity: true,
                            marketStats: true,
                            artist: true,
                            types: { include: { type: true } },
                            subtypes: { include: { subtype: true } },
                            weaknesses: { include: { type: true } },
                            resistances: { include: { type: true } }
                        }
                    }
                }
            });
            return newEntry;
        }),
    /**
     * Updates an existing entry in the logged-in user's collection.
     * Protected to ensure only the owner can update it.
     */
    updateEntry: protectedProcedure
        .input(
            z.object({
                entryId: z.string(), // The ID of the CollectionEntry
                purchasePrice: z.number().optional(),
                condition: z.enum(CardConditionValues).optional(),
                createdAt: z.date().optional()
            })
        )
        .mutation(async ({ input, ctx }) => {
            const { entryId, ...dataToUpdate } = input;
            await prisma.collectionEntry.updateMany({
                where: { id: entryId, userId: ctx.user.id },
                data: {
                    ...dataToUpdate,
                    condition: dataToUpdate.condition
                        ? (dataToUpdate.condition as CardCondition)
                        : undefined,
                    createdAt: input.createdAt
                }
            });
            return { success: true };
        }),
    /**
     * Removes an entry from the logged-in user's collection.
     * Protected to ensure only the owner can delete it.
     */
    removeFromCollection: protectedProcedure
        .input(z.object({ entryId: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const { entryId } = input;
            await prisma.collectionEntry.deleteMany({
                where: { id: entryId, userId: ctx.user.id }
            });
            return { success: true };
        }),
    getPortfolioHistory: protectedProcedure.query(async ({ ctx }) => {
        return await getPortfolioValue(ctx.user.id);
    })
});
