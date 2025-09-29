import { router } from './trpc';
import { pokemonCardRouter } from './routers/pokemonCardRouter';
import { pokemonMetadataRouter } from './routers/pokemonMetadata';

// combines all routers into one
export const appRouter = router({
    pokemonCard: pokemonCardRouter,
    pokemonMetadata: pokemonMetadataRouter
});

export type AppRouter = typeof appRouter;
