import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/../server/routers/_app';

//http://localhost:3000/api/trpc/pokemonCard.findMany?input=%7B%7D
const handler = (req: Request) =>
    fetchRequestHandler({
        endpoint: '/api/trpc',
        req,
        router: appRouter,
        createContext: () => ({}) // context for potential use
    });

export { handler as GET, handler as POST };
