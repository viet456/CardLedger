import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
    const secret = process.env.TURNSTILE_SECRET_KEY!;
    const form = new FormData();
    form.append('secret', secret);
    form.append('response', token);
    form.append('remoteip', ip);

    try {
        const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: form
        }).then((res) => res.json());

        return result.success === true;
    } catch (error) {
        console.error('Turnstile verification error:', error);
        return false;
    }
}

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

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error('Sign in error:', error);

        let errorMessage = 'Something went wrong';
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
