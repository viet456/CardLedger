import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPortfolioValue } from '../portfolioService';
import type { PortfolioChartPoint } from '../portfolioService';

vi.mock('next/cache', () => ({
    cacheTag: vi.fn(),
    cacheLife: vi.fn()
}));

const { mockFindManyCollection, mockFindManyPrices } = vi.hoisted(() => {
    return {
        mockFindManyCollection: vi.fn(),
        mockFindManyPrices: vi.fn()
    };
});

vi.mock('../../lib/prisma', () => ({
    prisma: {
        collectionEntry: { findMany: mockFindManyCollection },
        priceHistory: { findMany: mockFindManyPrices }
    }
}));

describe('getPortfolioValue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Returns empty array for user with no cards', async () => {
        mockFindManyCollection.mockResolvedValue([]);

        const result = await getPortfolioValue('user-123');
        expect(result).toEqual([]);
    });

    it('Calculates cost basis and market value correctly for a single card', async () => {
        // Mock User Collection: 1 Charizard bought for $50
        mockFindManyCollection.mockResolvedValue([
            {
                cardId: 'charizard-base',
                createdAt: new Date('2025-01-01'),
                purchasePrice: 50.0,
                condition: 'tcgNearMint'
            }
        ]);

        // Mock Price History: Price goes $100 -> $110
        mockFindManyPrices.mockResolvedValue([
            {
                cardId: 'charizard-base',
                timestamp: new Date('2025-01-01'),
                tcgNearMint: { toNumber: () => 100 }
            },
            {
                cardId: 'charizard-base',
                timestamp: new Date('2025-01-02'),
                tcgNearMint: { toNumber: () => 110 }
            }
        ]);

        const result = await getPortfolioValue('user-123');

        expect(result).toHaveLength(2);
        // Day 1: Cost $50, Value $100
        expect(result[0]).toEqual({
            date: '2025-01-01',
            price: 100,
            costBasis: 50
        });
        // Day 2: Cost $50, Value $110
        expect(result[1]).toEqual({
            date: '2025-01-02',
            price: 110,
            costBasis: 50
        });
    });

    it('Handles "Forward Fill" logic (missing price data uses last known price)', async () => {
        // Setup Collection: User owns Card A and Card B (bought on 2025-01-01)
        mockFindManyCollection.mockResolvedValue([
            {
                cardId: 'card-a',
                createdAt: new Date('2025-01-01T10:00:00Z'),
                purchasePrice: 10,
                condition: 'tcgNearMint'
            },
            {
                cardId: 'card-b',
                createdAt: new Date('2025-01-01T10:00:00Z'),
                purchasePrice: 10,
                condition: 'tcgNearMint'
            }
        ]);

        // Setup Prices:
        // Day 1: Both exist.
        // Day 2: Only A exists. B is missing.
        mockFindManyPrices.mockResolvedValue([
            {
                cardId: 'card-a',
                timestamp: new Date('2025-01-01T10:00:00Z'),
                tcgNearMint: { toNumber: () => 100 }
            },
            {
                cardId: 'card-b',
                timestamp: new Date('2025-01-01T10:00:00Z'),
                tcgNearMint: { toNumber: () => 100 }
            },
            {
                cardId: 'card-a',
                timestamp: new Date('2025-01-02T10:00:00Z'),
                tcgNearMint: { toNumber: () => 110 }
            }
        ]);

        const result: PortfolioChartPoint[] = await getPortfolioValue('user-123');

        // Debugging: If this fails, see what actually came back
        console.log('Test Result:', JSON.stringify(result, null, 2));

        expect(result).toHaveLength(2);

        // Day 1: 100 + 100 = 200
        expect(result[0].price).toBe(200);

        // Day 2: 110 (A) + 100 (B - Forward Filled) = 210
        expect(result[1].price).toBe(210);
    });
});
