import { publicProcedure, router } from '../trpc';
import { findCardsInputSchema } from '@/services/pokemonCardValidator';
import { findPokemonCards } from '@/services/pokemonCardService';

// imports validator and service to create an api procedure/endpoint
export const pokemonCardRouter = router({
    findMany: publicProcedure.input(findCardsInputSchema).query(async ({ input }) => {
        // calls on service with the validated input
        const result = await findPokemonCards(input);
        return result;
    })
});
