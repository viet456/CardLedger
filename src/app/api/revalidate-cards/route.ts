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
        // Revalidate set overview pages + sitemap files (src/lib/sitemaps.ts
        // carries the `set-data` tag, keeping lastmod tracking set.updatedAt).
        revalidateTag('set-data', 'days');

        // DISABLED: revalidateTag('price-history', 'days')
        //
        // Why: the daily run (scripts/updateMarketStats.ts -> this route)
        // marked all ~22k /cards/[cardId] pages stale at once, because every
        // card page uses getCachedPriceHistory (tagged `price-history`)
        // for its JSON-LD.
        // Each stale URL then re-invoked a function when a crawler hit it
        // (observed: ~4k invocations per 5-minute crawl burst) and blew
        // through the Vercel Fluid Compute included usage.
        //
        // Freshness is not needed here: user-visible prices render
        // client-side from IndexedDB, fed by the daily R2 history blob
        // (incrementHistoryIndex in updateMarketStats.ts) -- never from
        // server HTML. JSON-LD tolerates stale-by-a-day prices. Pages
        // stay edge-cached until a deploy or targeted revalidation.
        //
        // If product rich results ever need fresher JSON-LD prices,
        // revalidate only top-N cards via their `card-${cardId}` tags --
        // do NOT restore the global blast.

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
