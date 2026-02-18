import { publicProcedure, router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '@/src/lib/prisma';
import { getPortfolioValue } from '@/src/services/portfolioService';
import { TRPCError } from '@trpc/server';
import { Card, CardVariant } from '@prisma/client';
import { MarketStats } from '@prisma/client';
import { CardPrices } from '@/src/shared-types/price-api';
import { Decimal } from '@prisma/client/runtime/library';

function toNum(val: number | Decimal | null | undefined): number | null {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    // Check for Prisma Decimal .toNumber()
    if (val instanceof Decimal || (typeof val === 'object' && 'toNumber' in val)) {
        return val.toNumber();
    }
    const num = Number(val);
    return isNaN(num) ? null : num;
}

function mapMarketStatsToVariants(
    marketStats:
        | Pick<
              MarketStats,
              | 'tcgNearMintLatest'
              | 'tcgNormalLatest'
              | 'tcgHoloLatest'
              | 'tcgReverseLatest'
              | 'tcgFirstEditionLatest'
          >
        | null
        | undefined
): CardPrices | null {
    if (!marketStats) return null;

    return {
        tcgNearMint: toNum(marketStats.tcgNearMintLatest),
        tcgNormal: toNum(marketStats.tcgNormalLatest),
        tcgHolo: toNum(marketStats.tcgHoloLatest),
        tcgReverse: toNum(marketStats.tcgReverseLatest),
        tcgFirstEdition: toNum(marketStats.tcgFirstEditionLatest)
    };
}

// Helper to check if a variant physically exists on a card
function validateVariant(
    card: Pick<Card, 'hasNormal' | 'hasHolo' | 'hasReverse' | 'hasFirstEdition'>,
    requestedVariant: CardVariant
): CardVariant {
    let isValid = false;

    switch (requestedVariant) {
        case CardVariant.Normal:
            isValid = card.hasNormal;
            break;
        case CardVariant.Holo:
            isValid = card.hasHolo;
            break;
        case CardVariant.Reverse:
            isValid = card.hasReverse;
            break;
        case CardVariant.FirstEdition:
            isValid = card.hasFirstEdition;
            break;
    }

    if (isValid) return requestedVariant;

    // Fallback logic
    if (card.hasNormal) return CardVariant.Normal;
    if (card.hasHolo) return CardVariant.Holo;
    if (card.hasReverse) return CardVariant.Reverse;
    if (card.hasFirstEdition) return CardVariant.FirstEdition;

    return CardVariant.Normal;
}

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
                            marketStats: {
                                select: {
                                    tcgNearMintLatest: true,
                                    tcgNormalLatest: true,
                                    tcgHoloLatest: true,
                                    tcgReverseLatest: true,
                                    tcgFirstEditionLatest: true,
                                    tcgPlayerUpdatedAt: true
                                }
                            },
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

            return {
                entries: entries.map((entry) => {
                    const variants = mapMarketStatsToVariants(entry.card.marketStats);

                    const defaultPrice = variants
                        ? (variants.tcgNearMint ??
                          variants.tcgNormal ??
                          variants.tcgHolo ??
                          variants.tcgReverse ??
                          variants.tcgFirstEdition ??
                          0)
                        : 0;

                    return {
                        ...entry,
                        purchasePrice: Number(entry.purchasePrice),
                        variant: entry.variant || CardVariant.Normal,
                        card: {
                            ...entry.card,
                            price: defaultPrice,
                            variants: variants,
                            hasNormal: entry.card.hasNormal,
                            hasHolo: entry.card.hasHolo,
                            hasReverse: entry.card.hasReverse,
                            hasFirstEdition: entry.card.hasFirstEdition
                        }
                    };
                }),
                lastModified
            };
        }),
    /**
     * Adds a new card to a *logged-in* user's collection.
     * This is a protected procedure; it will fail if the user is not authenticated.
     */
    addToCollection: protectedProcedure
        .input(
            z.object({
                cardId: z.string(),
                purchasePrice: z.number().min(0, 'Price cannot be negative'),
                variant: z.nativeEnum(CardVariant)
            })
        )
        .mutation(async ({ input, ctx }) => {
            const { cardId, purchasePrice, variant } = input;
            const userId = ctx.user.id;
            // Fetch the Card first to validate capabilities
            const card = await prisma.card.findUnique({
                where: { id: cardId }
            });

            if (!card) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Card not found.'
                });
            }
            // Validate/Auto-correct the variant
            const validVariant = validateVariant(card, variant);

            const newEntry = await prisma.collectionEntry.create({
                data: {
                    userId,
                    cardId,
                    purchasePrice,
                    variant: validVariant
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
            const variants = mapMarketStatsToVariants(newEntry.card.marketStats);
            return {
                ...newEntry,
                purchasePrice: Number(newEntry.purchasePrice),
                card: {
                    ...newEntry.card,
                    variants: variants
                }
            };
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
                variant: z.nativeEnum(CardVariant).optional(),
                createdAt: z.date().optional()
            })
        )
        .mutation(async ({ input, ctx }) => {
            const { entryId, ...dataToUpdate } = input;
            const updateData: any = { ...dataToUpdate };
            // If updating variant, validate it against the Card
            if (dataToUpdate.variant) {
                // Fetch existing entry + card info
                const entry = await prisma.collectionEntry.findUnique({
                    where: { id: entryId, userId: ctx.user.id },
                    include: { card: true }
                });

                if (!entry) {
                    throw new TRPCError({ code: 'NOT_FOUND', message: 'Entry not found' });
                }

                // Auto-correct the variant
                updateData.variant = validateVariant(entry.card, dataToUpdate.variant);
            }

            await prisma.collectionEntry.updateMany({
                where: {
                    id: entryId,
                    userId: ctx.user.id
                },
                data: updateData
            });
            return {
                success: true,
                variant: updateData.variant ?? dataToUpdate.variant
            };
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
