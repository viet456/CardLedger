import { DenormalizedCard, SetObject, AbilityObject } from '@/src/shared-types/card-index';
import {
    Card,
    Set as PrismaSet,
    MarketStats,
    Rarity,
    Artist,
    Type,
    Subtype,
    Ability,
    Attack
} from '@prisma/client';

export type PrismaCardWithRelations = Card & {
    set: PrismaSet;

    marketStats?:
        | {
              [Key in keyof MarketStats]: MarketStats[Key] | string | number;
          }
        | null;
    rarity?: Rarity | null;
    artist?: Artist | null;

    types: { type: Type }[];
    subtypes: { subtype: Subtype }[];
    weaknesses: { type: Type; value: string | null }[];
    resistances: { type: Type; value: string | null }[];

    abilities?: Ability[];
    attacks?: (Attack & { cost: { type: Type }[] })[];
};

export function mapPrismaCardToDenormalized(
    card: PrismaCardWithRelations,
    setOverride?: SetObject
): DenormalizedCard {
    let set: SetObject;
    if (setOverride) {
        set = setOverride;
    } else {
        set = {
            id: card.set.id,
            name: card.set.name,
            printedTotal: card.set.printedTotal,
            series: card.set.series,
            // SuperJSON guarantees this is a real Date object now
            releaseDate: card.set.releaseDate.toISOString(),
            ptcgoCode: card.set.ptcgoCode,
            logoImageKey: card.set.logoImageKey,
            symbolImageKey: card.set.symbolImageKey
        };
    }

    const price = card.marketStats?.tcgNearMintLatest
        ? Number(card.marketStats.tcgNearMintLatest)
        : null;

    return {
        id: card.id,
        n: card.name,
        hp: card.hp,
        num: card.number,
        img: card.imageKey,
        pS: card.pokedexNumberSort,
        cRC: card.convertedRetreatCost,
        artist: card.artist?.name || null,
        rarity: card.rarity?.name || null,
        set: set,
        supertype: card.supertype,

        subtypes: card.subtypes?.map((s) => s.subtype.name) || [],
        types: card.types?.map((t) => t.type.name) || [],

        weaknesses:
            card.weaknesses?.map((w) => ({
                type: w.type.name,
                value: w.value
            })) || [],
        resistances:
            card.resistances?.map((r) => ({
                type: r.type.name,
                value: r.value
            })) || [],

        abilities: (card.abilities as AbilityObject[]) || [],
        attacks:
            card.attacks?.map((attack) => ({
                name: attack.name,
                cost: attack.cost?.map((c) => c.type.name) || [],
                damage: attack.damage,
                text: attack.text
            })) || [],

        rules: card.rules || [],
        evolvesFrom: card.evolvesFrom,
        evolvesTo: card.evolvesTo || [],

        legalities: {
            standard: card.standard,
            expanded: card.expanded,
            unlimited: card.unlimited
        },

        pokedexNumbers: card.nationalPokedexNumbers || [],
        ancientTrait: card.ancientTraitName
            ? { name: card.ancientTraitName, text: card.ancientTraitText || '' }
            : null,

        price: price
    };
}
