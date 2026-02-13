import { prisma } from '@/src/lib/prisma';
import { cacheTag, cacheLife } from 'next/cache';
import { mapPrismaCardToDenormalized } from '@/src/utils/cardMapper';
import { SetObject } from '@/src/shared-types/card-index';

export async function getCachedSetData(setId: string) {
    'use cache';
    cacheTag('set-data', `set-${setId}`);
    cacheLife('days');

    const setWithCards = await prisma.set.findUnique({
        where: { id: setId },
        include: {
            cards: {
                orderBy: { number: 'asc' },
                include: {
                    artist: true,
                    rarity: true,
                    types: { include: { type: true } },
                    subtypes: { include: { subtype: true } },
                    weaknesses: { include: { type: true } },
                    resistances: { include: { type: true } },
                    abilities: true,
                    attacks: {
                        include: {
                            cost: { include: { type: true } }
                        }
                    },
                    marketStats: {
                        select: {
                            tcgNearMintLatest: true,
                            tcgNormalLatest: true,
                            tcgHoloLatest: true,
                            tcgReverseLatest: true,
                            tcgFirstEditionLatest: true,
                            tcgPlayerUpdatedAt: true,
                        }
                    },
                    set: true
                }
            }
        }
    });

    if (!setWithCards) return null;
    const setInfo: SetObject = {
        id: setWithCards.id,
        name: setWithCards.name,
        total: setWithCards.total,
        printedTotal: setWithCards.printedTotal,
        logoImageKey: setWithCards.logoImageKey,
        symbolImageKey: setWithCards.symbolImageKey,
        series: setWithCards.series,
        releaseDate: setWithCards.releaseDate.toISOString().split('T')[0],
        ptcgoCode: setWithCards.ptcgoCode
    };

    const denormalizedCards = setWithCards.cards.map((card) =>
        mapPrismaCardToDenormalized(card, setInfo)
    );
    return {
        setInfo: setInfo,
        cards: denormalizedCards
    };
}
