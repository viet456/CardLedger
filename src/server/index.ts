import { router } from './trpc';
import { pokemonCardRouter } from './routers/pokemonCardRouter';
import { collectionRouter } from './routers/collectionRouter';

// combines all routers into one
export const appRouter = router({
    pokemonCard: pokemonCardRouter,
    collection: collectionRouter
});

export type AppRouter = typeof appRouter;
