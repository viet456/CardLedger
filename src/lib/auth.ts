import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/src/lib/prisma';
import { nextCookies } from 'better-auth/next-js';
import { username } from 'better-auth/plugins';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: ['https://cardledger.io', 'https://www.cardledger.io'],
    database: prismaAdapter(prisma, {
        provider: 'postgresql'
    }),
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
        },
        discord: {
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!
        }
    },
    advanced: {
        defaultCookieAttributes: {
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true
        }
    },
    emailVerification: {
        sendOnSignUp: true,
        sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
            await resend.emails.send({
                from: 'CardLedger <noreply@updates.cardledger.io>',
                to: user.email,
                subject: 'Verify your email',
                html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`
            });
        }
    },
    emailAndPassword: {
        enabled: true,
        autoSignIn: true,
        requireEmailVerification: true,
        minPasswordLength: 8,
        sendResetPassword: async ({ user, url }) => {
            await resend.emails.send({
                from: 'CardLedger <noreply@updates.cardledger.io>',
                to: user.email,
                subject: 'Reset your password',
                html: `<p>Click <a href="${url}">here</a> to reset your password.</p>`
            });
        }
    },
    plugins: [username(), nextCookies()]
});
