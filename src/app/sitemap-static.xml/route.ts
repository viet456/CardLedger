import { NextResponse } from 'next/server';
import { getStaticSitemapXml } from '@/src/lib/sitemaps';

const XML_HEADERS = {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
};

export async function GET() {
    return new NextResponse(await getStaticSitemapXml(), { headers: XML_HEADERS });
}
