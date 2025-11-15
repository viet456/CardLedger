import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const secret = request.nextUrl.searchParams.get('token');

    if (secret !== process.env.REVALIDATION_TOKEN) {
        return new NextResponse(JSON.stringify({ message: 'Invalid token' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    try {
        // Revalidate all pages with fetches tagged with 'card-data'
        revalidateTag('card-data');

        return new NextResponse(JSON.stringify({ revalidated: true, now: Date.now() }), {
            headers: { 'Content-Type': '' }
        });
    } catch (error: unknown) {
        let message = 'An unknown error occurred';
        if (error instanceof Error) {
            message = error.message;
        }
        return new NextResponse(JSON.stringify({ message: message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
