/**
 * JSON-LD builders (schema.org) rendered as application/ld+json scripts.
 * Server-side only — pure data builders, no client dependencies.
 */

export const SITE_URL = 'https://www.cardledger.io';
export const ASSETS_URL = 'https://assets.cardledger.io';

/** Canonical optimized-card-image URL (mirrors the bucket logic in src/lib/loader.ts). */
export function cardImageUrl(imageKey: string | null | undefined): string | undefined {
    if (!imageKey) return undefined;
    const clean = imageKey
        .replace(/^\//, '')
        .replace(/\.(png|jpg|jpeg|webp|avif|gif)$/i, '');
    return `${ASSETS_URL}/optimized/${clean}/640.avif`;
}

export interface Crumb {
    name: string;
    /** Site-relative path (e.g. "/sets/base1"); omit for the current page. */
    url?: string;
}

export function breadcrumbJsonLd(crumbs: Crumb[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((crumb, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: crumb.name,
            ...(crumb.url ? { item: `${SITE_URL}${crumb.url}` } : {})
        }))
    };
}

export interface CardProductInput {
    id: string;
    name: string;
    number: string;
    setName: string;
    imageKey: string | null;
    description: string | null;
    releaseDate: string; // YYYY-MM-DD
    /** Latest headline market price, USD */
    price: number | null;
}

/** Product + Offer JSON-LD for a single card page. */
export function cardProductJsonLd(card: CardProductInput) {
    const url = `${SITE_URL}/cards/${card.id}`;
    const fullName = `${card.name} #${card.number} (${card.setName})`;
    const image = cardImageUrl(card.imageKey);

    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: fullName,
        url,
        ...(image ? { image } : {}),
        description:
            card.description ??
            `${fullName} from the ${card.setName} Pokémon TCG set, released ${card.releaseDate}.`,
        brand: { '@type': 'Brand', name: 'Pokémon' },
        category: 'Pokémon Trading Card Game',
        ...(card.price !== null
            ? {
                  offers: {
                      '@type': 'Offer',
                      price: card.price,
                      priceCurrency: 'USD',
                      availability: 'https://schema.org/InStock',
                      url
                  }
              }
            : {})
    };
}
