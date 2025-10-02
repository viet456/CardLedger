import { findPokemonCards } from '../services/pokemonCardService';

type FindCardsData = Awaited<ReturnType<typeof findPokemonCards>>;
export type PokemonCardType = FindCardsData extends { cards: Array<infer Card> } ? Card : never;

export type ClientPokemonCardType = Omit<PokemonCardType, 'set'> & {
    set: Omit<PokemonCardType['set'], 'releaseDate'> & {
        releaseDate: string;
    };
};
