import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import { loggerLink } from '@trpc/client';
import type { AppRouter } from '@/src/server';
import superjson from 'superjson';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
    links: [
        loggerLink({
            enabled: (op) =>
                process.env.NODE_ENV === 'development' ||
                (op.direction === 'down' && op.result instanceof Error)
        }),
        httpBatchLink({
            url: '/api/trpc',
            transformer: superjson
        })
    ]
});
