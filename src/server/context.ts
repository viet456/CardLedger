import { auth } from '../lib/auth';
import { prisma } from '../lib/prisma';
import { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';

export async function createContext({ req }: FetchCreateContextFnOptions) {
    const session = await auth.api.getSession({
        headers: req.headers
    });
    return {
        prisma,
        user: session?.user ?? null,
        headers: req.headers
    };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
