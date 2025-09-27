import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { findPokemonCards } from '../pokemonCardService';
import { PrismaClient } from '@prisma/client';
import type { FindCardsParams } from '../pokemonCardService';

vi.mock('@prisma/client', () => {
    const mockPrismaClient = {
        card: {
            findMany: vi.fn()
        },
        $queryRaw: vi.fn()
    };
    return { PrismaClient: vi.fn(() => mockPrismaClient) };
});

const prisma = new PrismaClient();

describe('findPokemonCardsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should use trigram search and filter by IDs when a search term is provided', async () => {
        const mockIds = [{ id: 'card-abc' }, { id: 'card-def' }];
        (prisma.$queryRaw as Mock).mockResolvedValue(mockIds);
        (prisma.card.findMany as Mock).mockResolvedValue({ cards: [], nextCursor: null });

        const testParams: FindCardsParams = { search: 'Charizard' };
        await findPokemonCards(testParams);
        expect(prisma.$queryRaw).toHaveBeenCalled();
        expect(prisma.card.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: { in: ['card-abc', 'card-def'] }
                }
            })
        );
    });

    it('should build the correct where clause for multiple filters', async () => {
        const mockIds = [{ id: 'card-pika-1' }, { id: 'card-pika-2' }];
        (prisma.$queryRaw as Mock).mockResolvedValue(mockIds);
        (prisma.card.findMany as Mock).mockResolvedValue({ cards: [], nextCursor: null });

        const testParams: FindCardsParams = {
            search: 'Pikachu',
            rarity: 'Promo',
            type: 'Lightning'
        };

        await findPokemonCards(testParams);

        expect(prisma.card.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: { in: ['card-pika-1', 'card-pika-2'] },
                    rarity: 'Promo',
                    types: {
                        some: {
                            type: {
                                name: { in: ['Lightning'] }
                            }
                        }
                    }
                }
            })
        );
    });
});
