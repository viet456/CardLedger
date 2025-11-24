import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './context';
import superjson from 'superjson';

const t = initTRPC.context<Context>().create({
    transformer: superjson
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async function isAuthed(opts) {
    const { ctx } = opts;
    if (!ctx.user?.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    return opts.next({
        ctx: {
            ...ctx,
            user: ctx.user
        }
    });
});
