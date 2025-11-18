import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { verifyTurnstile } from '@/src/lib/verifyTurnstile';
import { APIError } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { identifier, password, turnstileToken } = body;

        // Verify Turnstile FIRST
        if (!turnstileToken) {
            return NextResponse.json({ error: 'Security check required' }, { status: 400 });
        }

        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

        const isValid = await verifyTurnstile(turnstileToken, ip);
        if (!isValid) {
            return NextResponse.json({ error: 'Security verification failed' }, { status: 400 });
        }

        // Determine if identifier is email or username
        const isEmail = identifier.includes('@');

        // Sign in using Better Auth's internal API
        const result = isEmail
            ? await auth.api.signInEmail({
                  body: { email: identifier, password },
                  headers: req.headers
              })
            : await auth.api.signInUsername({
                  body: { username: identifier, password },
                  headers: req.headers
              });
        if (!result) {
            throw new APIError('UNAUTHORIZED');
        }

        if (result.token && result.user) {
            const response = NextResponse.json({ user: result.user });
            response.cookies.set('auth_session', result.token, {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/'
            });
            return response;
        }

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error('Sign in error:', error);

        if (error instanceof APIError) {
            if (error.message === 'EMAIL_NOT_VERIFIED') {
                return NextResponse.json(
                    { error: 'Your email is not verified. Please check your inbox.' },
                    { status: 401 }
                );
            }
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        let errorMessage = 'Something went wrong';
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
