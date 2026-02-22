'use client';
import { DenormalizedCard, NormalizedCard, LookupTables } from '@/src/shared-types/card-index';
import { FilterState } from '@/src/lib/store/searchStore';
import { SortableKey } from '@/src/services/pokemonCardValidator';
import { CardPrices } from '../shared-types/price-api';

type LookupsForDenorm = Omit<LookupTables, 'weaknesses' | 'resistances'>;

// Combines normalized cards with prices into DenormalizedCard type
// Applies sorting to this type

export function denormalizeSingleCard(
    card: NormalizedCard,
    lookups: Omit<LookupTables, 'weaknesses' | 'resistances'>,
    prices: Record<string, CardPrices> = {}
): DenormalizedCard {
    const { artists, rarities, sets, types, subtypes, supertypes, abilities, attacks, rules } = lookups;
    const priceData = prices[card.id];

    const effectivePrice = priceData
        ? (priceData.tcgNearMint ?? priceData.tcgNormal ?? priceData.tcgHolo ?? 
           priceData.tcgReverse ?? priceData.tcgFirstEdition ?? null)
        : null;

    return {
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
        price: effectivePrice,
        variants: priceData
    };
}