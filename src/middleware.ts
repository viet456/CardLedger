import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

const GUEST_ONLY_ROUTES = ['/sign-in', '/sign-up'];
const PROTECTED_ROUTES = ['/dashboard'];

export async function middleware(request: NextRequest) {
    const sessionCookie = getSessionCookie(request);
    const pathname = request.nextUrl.pathname;

    if (sessionCookie && GUEST_ONLY_ROUTES.some((route) => pathname.startsWith(route))) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (!sessionCookie && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
        return NextResponse.redirect(new URL('/sign-in', request.url));
    }

    // If cookie exists, let them pass.
    return NextResponse.next();
}

export const config = {
    matcher: ['/dashboard/:path*', '/sign-in']
};
