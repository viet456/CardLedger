import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/src/lib/prisma';
import { nextCookies } from 'better-auth/next-js';
import { username } from 'better-auth/plugins';

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: 'postgresql'
    }),
    emailAndPassword: {
        enabled: true
    },
    socialProviders: {},
    plugins: [username(), nextCookies()]
});
