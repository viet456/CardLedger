import { router } from './trpc';
import { collectionRouter } from './routers/collectionRouter';

// combines all routers into one
export const appRouter = router({
    collection: collectionRouter
});

export type AppRouter = typeof appRouter;
