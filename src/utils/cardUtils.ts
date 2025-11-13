'use client';
import { DenormalizedCard, NormalizedCard, LookupTables } from '@/src/shared-types/card-index';
import { FilterState } from '@/src/lib/store/searchStore';
import { SortableKey } from '@/src/services/pokemonCardValidator';

type LookupsForDenorm = Omit<LookupTables, 'weaknesses' | 'resistances'>;

// Combines normalized cards with prices into DenormalizedCard type
// Applies sorting to this type
export function denormalizeAndSortCards(
    normalizedCards: NormalizedCard[],
    lookups: LookupsForDenorm,
    prices: { [cardId: string]: number },
    filters: FilterState
): DenormalizedCard[] {
    const { artists, rarities, sets, types, subtypes, supertypes, abilities, attacks, rules } =
        lookups;

    if (!normalizedCards.length || !sets.length) return [];

    const finalCards: DenormalizedCard[] = normalizedCards.map((card) => ({
        id: card.id,
        n: card.n,
        hp: card.hp,
        num: card.num,
        img: card.img,
        pS: card.pS,
        cRC: card.cRC,
        artist: card.a !== null ? artists[card.a] : null,
        rarity: card.r !== null ? rarities[card.r] : null,
        set: sets[card.s],
        supertype: supertypes[card.st],
        subtypes: card.sb.map((id) => subtypes[id]),
        types: card.t.map((id) => types[id]),
        weaknesses: (card.w || []).map((w) => ({ type: types[w.t], value: w.v })),
        resistances: (card.rs || []).map((r) => ({ type: types[r.t], value: r.v })),
        abilities: (card.ab || []).map((id) => abilities[id]),
        pokedexNumbers: card.pdx,
        ancientTrait: card.aT ? { name: card.aT.n, text: card.aT.t } : null,
        rules: (card.ru || []).map((id) => rules[id]),
        attacks: (card.ak || []).map((id) => attacks[id]),
        evolvesFrom: card.eF,
        evolvesTo: card.eT || [],
        legalities: {
            standard: card.leg?.s,
            expanded: card.leg?.e,
            unlimited: card.leg?.u
        },
        price: prices[card.id] ?? null
    }));

    const sortBy = (filters.sortBy || (filters.search ? 'relevance' : 'rD')) as
        | SortableKey
        | 'relevance';
    const sortOrder = filters.sortOrder || 'desc';

    if (sortBy === 'relevance') {
        return finalCards;
    }

    const setReleaseDateMap = new Map<string, number>(
        sets.map((set) => [set.id, new Date(set.releaseDate).getTime()])
    );

    finalCards.sort((a, b) => {
        switch (sortBy) {
            case 'price':
                const priceA = a.price;
                const priceB = b.price;
                const isAInvalid = priceA === null || priceA === undefined;
                const isBInvalid = priceB === null || priceB === undefined;
                if (isAInvalid && isBInvalid) return 0;
                if (isAInvalid) return 1;
                if (isBInvalid) return -1;
                return sortOrder === 'desc' ? priceB - priceA : priceA - priceB;

            case 'n':
                const nameDiff = a.n.localeCompare(b.n);
                if (nameDiff !== 0) return nameDiff;
                return setReleaseDateMap.get(a.set.id)! - setReleaseDateMap.get(b.set.id)!;
            case 'num':
                return a.num.localeCompare(b.num, undefined, { numeric: true });
            case 'pS':
                const pokedexDiff = (a.pS || 9999) - (b.pS || 9999);
                if (pokedexDiff !== 0) return pokedexDiff;
                return setReleaseDateMap.get(a.set.id)! - setReleaseDateMap.get(b.set.id)!;
            case 'rD':
            default:
                const dateDiff =
                    setReleaseDateMap.get(a.set.id)! - setReleaseDateMap.get(b.set.id)!;
                if (dateDiff !== 0) return dateDiff;
                return a.num.localeCompare(b.num, undefined, { numeric: true });
        }
    });

    if (sortOrder === 'desc' && sortBy !== 'price') {
        finalCards.reverse();
    }

    return finalCards;
}
