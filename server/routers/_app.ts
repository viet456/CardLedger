import { router } from '../trpc';
import { pokemonCardRouter } from './pokemonCardRouter';

// combines all routers into one
export const appRouter = router({
    pokemonCard: pokemonCardRouter
});

export type AppRouter = typeof appRouter;
