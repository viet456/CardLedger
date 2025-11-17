import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { verifyTurnstile } from '@/src/lib/verifyTurnstile';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { newPassword, resetToken, turnstileToken } = body;

        // Verify Turnstile first
        if (!turnstileToken) {
            return NextResponse.json({ error: 'Security check required' }, { status: 400 });
        }

        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

        const isValid = await verifyTurnstile(turnstileToken, ip);
        if (!isValid) {
            return NextResponse.json({ error: 'Security verification failed' }, { status: 400 });
        }

        const result = await auth.api.resetPassword({
            body: {
                token: resetToken,
                newPassword
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
