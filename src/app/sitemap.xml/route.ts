import { NextResponse } from 'next/server';
import { getSitemapIndexXml } from '@/src/lib/sitemaps';

export const XML_HEADERS = {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
};

export async function GET() {
    return new NextResponse(await getSitemapIndexXml(), { headers: XML_HEADERS });
}
