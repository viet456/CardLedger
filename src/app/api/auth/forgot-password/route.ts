import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { verifyTurnstile } from '@/src/lib/verifyTurnstile';

export async function POST(req: NextResponse) {
    try {
        const body = await req.json();
        const { email, redirectTo, turnstileToken } = body;

        // Verify Turnstile FIRST
        if (!turnstileToken) {
            return NextResponse.json({ error: 'Security check required' }, { status: 400 });
        }

        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

        const isValid = await verifyTurnstile(turnstileToken, ip);
        if (!isValid) {
            return NextResponse.json({ error: 'Security verification failed' }, { status: 400 });
        }

        // If valid, call the better-auth server api
        const result = await auth.api.forgetPassword({
            body: {
                email,
                redirectTo
            },
            headers: req.headers
        });

        return NextResponse.json(result);
    } catch (error: unknown) {
        let errorMessage = 'Something went wrong';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
