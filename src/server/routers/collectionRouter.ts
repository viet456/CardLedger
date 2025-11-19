import { publicProcedure, router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/src/lib/prisma';
import { CardCondition } from '@prisma/client';

export const collectionRouter = router({
    /**
     * Gets all collection entries for a specific user.
     * This is public, so anyone can view a collection (eg for public profiles).
     */
    getCollection: publicProcedure
        .input(z.object({ userId: z.string() }))
        .query(async ({ input }) => {
            return prisma.collectionEntry.findMany({
                where: { userId: input.userId },
                include: { card: true },
                orderBy: { createdAt: 'desc' }
            });
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
                condition: z.enum(CardCondition)
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
                    condition
                    //variantName
                }
            });
            return newEntry;
        }),
    /**
     * Updates an existing entry in the logged-in user's collection.
     * Protected to ensure only the owner can update it.
     */
    updateCollectionEntry: protectedProcedure
        .input(
            z.object({
                entryId: z.string(), // The ID of the CollectionEntry
                purchasePrice: z.number().optional(),
                condition: z.enum(CardCondition).optional()
            })
        )
        .mutation(async ({ input, ctx }) => {
            const { entryId, ...dataToUpdate } = input;
            // Ensure user owns this entry
            const entry = await prisma.collectionEntry.findFirstOrThrow({
                where: { id: entryId, userId: ctx.user.id }
            });
            const updatedEntry = await prisma.collectionEntry.update({
                where: { id: entry.id },
                data: dataToUpdate
            });
            return updatedEntry;
        }),
    /**
     * Removes an entry from the logged-in user's collection.
     * Protected to ensure only the owner can delete it.
     */
    removeFromCollection: protectedProcedure
        .input(z.object({ entryId: z.string() }))
        .mutation(async ({ input, ctx }) => {
            const { entryId } = input;
            // Ensure user owns this entry
            await prisma.collectionEntry.findFirstOrThrow({
                where: {
                    id: entryId,
                    userId: ctx.user.id
                }
            });
            await prisma.collectionEntry.delete({
                where: { id: entryId }
            });
            return { success: true };
        })
});
