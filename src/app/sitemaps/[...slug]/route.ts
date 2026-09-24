import { NextRequest, NextResponse } from 'next/server';
import { getSetCardsSitemapXml } from '@/src/lib/sitemaps';

const XML_HEADERS = {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
};

/**
 * Per-set card sitemaps: /sitemaps/{setId}.xml
 * (chunked so each file stays small and caches/invalidates per set)
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string[] }> }
) {
    const { slug } = await params;
    if (slug.length !== 1 || !slug[0].endsWith('.xml')) {
        return new NextResponse('Not found', { status: 404 });
    }
    const setId = slug[0].slice(0, -'.xml'.length);

    const xml = await getSetCardsSitemapXml(setId);
    if (xml === null) {
        return new NextResponse('Not found', { status: 404 });
    }
    return new NextResponse(xml, { headers: XML_HEADERS });
}
