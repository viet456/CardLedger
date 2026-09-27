/**
 * Sitemap generation — sitemap index + chunked per-set card sitemaps.
 *
 * Replaces the old flat sitemap.ts (3.7MB, re-queried ~44k rows per request,
 * wrong lastmod). All XML comes from cached functions tagged `set-data`
 * (plus `set-{setId}` on per-set files) so the existing /api/revalidate-cards
 * route invalidates every sitemap file automatically.
 *
 * Layout:
 *   /sitemap.xml            index        (sitemapindex)
 *   /sitemap-static.xml     static pages (urlset)
 *   /sitemap-sets.xml       all /sets/{id} pages (urlset)
 *   /sitemaps/{setId}.xml   /cards/{id} pages of one set (urlset)
 *
 * Note on tags: per-set files carry `set-data` + `set-{setId}` only. Tagging
 * them with hundreds of `card-{id}` entries would blow past Next's per-cache
 * entry tag budget; card-level invalidation flows through the set tags (and
 * card page caches themselves carry `card-{id}` for targeted revalidation).
 *
 * Real lastmod: set.updatedAt (bumped by scripts/populate.ts on metadata sync),
 * falling back to / combined with the release date columns.
 */
import { prisma } from '@/src/lib/prisma';
import { cacheLife, cacheTag } from 'next/cache';

const BASE_URL = 'https://www.cardledger.io';

function xmlEscape(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function isoDay(value: Date): string {
    return value.toISOString().split('T')[0];
}

function laterOf(a: Date, b: Date): Date {
    return a.getTime() >= b.getTime() ? a : b;
}

interface SitemapEntry {
    loc: string;
    lastmod: string | null;
}

function renderUrlset(entries: SitemapEntry[]): string {
    const items = entries
        .map(
            (e) =>
                `  <url>\n    <loc>${xmlEscape(e.loc)}</loc>${
                    e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''
                }\n  </url>`
        )
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

function renderSitemapIndex(entries: SitemapEntry[]): string {
    const items = entries
        .map(
            (e) =>
                `  <sitemap>\n    <loc>${xmlEscape(e.loc)}</loc>${
                    e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''
                }\n  </sitemap>`
        )
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

async function getSetSummaries() {
    return prisma.set.findMany({
        select: { id: true, updatedAt: true, releaseDate: true },
        orderBy: { releaseDate: 'desc' }
    });
}

/** /sitemap.xml — the sitemap index. */
export async function getSitemapIndexXml(): Promise<string> {
    'use cache';
    cacheTag('set-data');
    cacheLife('days');

    const sets = await getSetSummaries();
    const newestRelease = sets.length > 0 ? sets[0].releaseDate : new Date(0);
    const newestUpdate = sets.reduce((acc, s) => laterOf(acc, s.updatedAt), new Date(0));

    const entries: SitemapEntry[] = [
        { loc: `${BASE_URL}/sitemap-static.xml`, lastmod: isoDay(newestRelease) },
        { loc: `${BASE_URL}/sitemap-sets.xml`, lastmod: isoDay(newestUpdate) },
        ...sets.map((set) => ({
            loc: `${BASE_URL}/sitemaps/${encodeURIComponent(set.id)}.xml`,
            lastmod: isoDay(laterOf(set.updatedAt, set.releaseDate))
        }))
    ];
    return renderSitemapIndex(entries);
}

/** /sitemap-static.xml — the static hub pages. */
export async function getStaticSitemapXml(): Promise<string> {
    'use cache';
    cacheTag('set-data');
    cacheLife('days');

    const sets = await getSetSummaries();
    const newestRelease = sets.length > 0 ? sets[0].releaseDate : new Date();
    const day = isoDay(newestRelease);

    return renderUrlset([
        { loc: `${BASE_URL}/`, lastmod: day },
        { loc: `${BASE_URL}/cards`, lastmod: day },
        { loc: `${BASE_URL}/sets`, lastmod: day },
        { loc: `${BASE_URL}/about`, lastmod: null }
    ]);
}

/** /sitemap-sets.xml — every /sets/{id} page. */
export async function getSetsSitemapXml(): Promise<string> {
    'use cache';
    cacheTag('set-data', 'all-sets');
    cacheLife('days');

    const sets = await getSetSummaries();
    return renderUrlset(
        sets.map((set) => ({
            loc: `${BASE_URL}/sets/${encodeURIComponent(set.id)}`,
            lastmod: isoDay(laterOf(set.updatedAt, set.releaseDate))
        }))
    );
}

/** /sitemaps/{setId}.xml — the /cards/{id} pages of a single set. */
export async function getSetCardsSitemapXml(setId: string): Promise<string | null> {
    'use cache';
    cacheTag('set-data', `set-${setId}`);
    cacheLife('days');

    const set = await prisma.set.findUnique({
        where: { id: setId },
        select: {
            updatedAt: true,
            releaseDate: true,
            cards: { select: { id: true, releaseDate: true } }
        }
    });
    if (!set) return null;

    return renderUrlset(
        set.cards.map((card) => ({
            loc: `${BASE_URL}/cards/${encodeURIComponent(card.id)}`,
            // Real lastmod: the later of the card's release and its set's last
            // metadata sync (populate.ts bumps set.updatedAt)
            lastmod: isoDay(laterOf(card.releaseDate, set.updatedAt))
        }))
    );
}
