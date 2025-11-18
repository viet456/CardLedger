import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { verifyTurnstile } from '@/src/lib/verifyTurnstile';
import { Prisma } from '@prisma/client';
import { APIError } from 'better-auth';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password, username, name, turnstileToken } = body;

        // Verify Turnstile FIRST
        if (!turnstileToken) {
            return NextResponse.json({ error: 'Security check required' }, { status: 400 });
        }

        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

        const isValid = await verifyTurnstile(turnstileToken, ip);
        if (!isValid) {
            return NextResponse.json({ error: 'Security verification failed' }, { status: 400 });
        }

        // Create the user using Better Auth's internal API
        const result = await auth.api.signUpEmail({
            body: {
                email,
                password,
                name,
                username
            },
            headers: req.headers
        });

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error('Sign up error:', error);

        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            // P2002 is the code for 'Unique constraint failed'
            if (error.code === 'P2002') {
                return NextResponse.json(
                    { error: 'This email or username is already taken.' },
                    { status: 409 }
                );
            }
        }

        if (error instanceof APIError) {
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        let errorMessage = 'Something went wrong';
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
