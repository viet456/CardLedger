import { prisma } from '../lib/prisma';
import { cacheTag, cacheLife } from 'next/cache';
import { CardVariant } from '@prisma/client';

type PriceRow = {
    cardId: string;
    timestamp: string;
    tcgNearMint: number | null; // Base Price
    tcgNormal: number | null;
    tcgHolo: number | null;
    tcgReverse: number | null;
    tcgFirstEdition: number | null;
};

function getPriceForVariant(row: PriceRow, variant: CardVariant) {
    let specificPrice: number | null = null;

    switch (variant) {
        case 'Normal':
            specificPrice = row.tcgNormal;
            break;
        case 'Holo':
            specificPrice = row.tcgHolo;
            break;
        case 'Reverse':
            specificPrice = row.tcgReverse;
            break;
        case 'FirstEdition':
            specificPrice = row.tcgFirstEdition;
            break;
    }
    // Fall back to tcgNearMint price value
    return specificPrice ?? row.tcgNearMint ?? 0;
}

// Complete price history of crds
export async function getCachedBulkPriceHistory(cardIds: string[]) {
    'use cache';
    cacheTag('portfolio-prices');
    cacheLife('days');

    const history = await prisma.priceHistory.findMany({
        where: {
            cardId: { in: cardIds }
        },
        orderBy: { timestamp: 'asc' },
        select: {
            cardId: true,
            timestamp: true,
            tcgNearMint: true,
            tcgNormal: true,
            tcgHolo: true,
            tcgReverse: true,
            tcgFirstEdition: true
        }
    });

    return history.map((row) => ({
        cardId: row.cardId,
        timestamp: row.timestamp.toISOString().split('T')[0],
        tcgNearMint: row.tcgNearMint?.toNumber() ?? null,
        tcgNormal: row.tcgNormal?.toNumber() ?? null,
        tcgHolo: row.tcgHolo?.toNumber() ?? null,
        tcgReverse: row.tcgReverse?.toNumber() ?? null,
        tcgFirstEdition: row.tcgFirstEdition?.toNumber() ?? null
    }));
}

export type PortfolioChartPoint = {
    date: string;
    price: number;
    costBasis: number;
};

// tcgNearMint value
export async function getPortfolioValue(userId: string): Promise<PortfolioChartPoint[]> {
    const collection = await prisma.collectionEntry.findMany({
        where: { userId },
        select: {
            cardId: true,
            createdAt: true,
            purchasePrice: true,
            variant: true
        }
    });
    if (collection.length === 0) return [];

    const distinctCardIds = Array.from(new Set(collection.map((c) => c.cardId)));
    const rawHistory = await getCachedBulkPriceHistory(distinctCardIds);
    const allDates = Array.from(new Set(rawHistory.map((h) => h.timestamp))).sort();
    const priceLookup = new Map<string, Map<string, PriceRow>>();

    for (const h of rawHistory) {
        if (!priceLookup.has(h.cardId)) {
            priceLookup.set(h.cardId, new Map());
        }
        priceLookup.get(h.cardId)!.set(h.timestamp, h);
    }
    const chartData: PortfolioChartPoint[] = [];
    const lastKnownPrices = new Map<string, number>();
    for (const date of allDates) {
        let dailyMarket = 0;
        let dailyCost = 0;

        for (const entry of collection) {
            const purchaseDate = entry.createdAt.toISOString().split('T')[0];

            // "Last Known Price" cache for this card
            const cardPrices = priceLookup.get(entry.cardId);
            const todaysPriceRow = cardPrices?.get(date);

            if (todaysPriceRow) {
                // We have fresh data today, update the cache.
                const price = getPriceForVariant(todaysPriceRow, entry.variant);
                lastKnownPrices.set(entry.cardId, price);
            }

            // Only count towards portfolio total if we owned it on this date
            if (date < purchaseDate) continue;

            // Add Cost Basis
            dailyCost += Number(entry.purchasePrice);

            // Add Market Value (Using Forward Fill)
            // Use today's price if available, otherwise use the last known price.
            // If we have NEVER seen a price for this card yet, it contributes 0.
            const currentPrice = lastKnownPrices.get(entry.cardId) || 0;
            dailyMarket += currentPrice;
        }

        if (dailyCost > 0) {
            chartData.push({
                date,
                price: Number(dailyMarket.toFixed(2)),
                costBasis: Number(dailyCost.toFixed(2))
            });
        }
    }
    return chartData;
}
