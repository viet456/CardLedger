import { router } from '../trpc';
import { pokemonCardRouter } from './pokemonCardRouter';
import { pokemonMetadataRouter } from './pokemonMetadata';

// combines all routers into one
export const appRouter = router({
    pokemonCard: pokemonCardRouter,
    pokemonMetadata: pokemonMetadataRouter
});

export type AppRouter = typeof appRouter;
