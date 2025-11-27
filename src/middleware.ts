import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

export async function middleware(request: NextRequest) {
    const sessionCookie = getSessionCookie(request);

    // OPTIMISTIC CHECK:
    // If no cookie exists, we know for sure they are logged out.
    // Redirect them to sign-in immediately.
    if (!sessionCookie) {
        return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    // If cookie exists, let them pass.
    return NextResponse.next();
}

export const config = {
    // Only run this on the dashboard routes
    matcher: ['/dashboard/:path*']
};
