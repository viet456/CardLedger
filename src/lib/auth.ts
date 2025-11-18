import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/src/lib/prisma';
import { nextCookies } from 'better-auth/next-js';
import { username } from 'better-auth/plugins';
import { Resend } from 'resend';
import { captcha } from 'better-auth/plugins';

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: 'postgresql'
    }),
    email: {
        sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
            await resend.emails.send({
                from: 'CardLedger <noreply@updates.cardledger.io>',
                to: user.email,
                subject: 'Reset your password',
                html: `<p>Click <a href="${url}">here</a> to reset your password.</p>`
            });
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
        minPasswordLength: 8
    },
    socialProviders: {},
    plugins: [
        username(),
        captcha({
            provider: 'cloudflare-turnstile',
            secretKey: process.env.TURNSTILE_SECRET_KEY!
        }),
        nextCookies()
    ]
});
