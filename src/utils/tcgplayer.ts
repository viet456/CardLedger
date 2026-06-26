const AFFILIATE_PARTNER_ID = '7386340';

/**
 * Build a TCGplayer affiliate URL for a card.
 * Uses direct product link when tcgPlayerId is available,
 * falls back to a search query (name + set) otherwise.
 */
export function getTcgPlayerUrl(tcgPlayerId: number | null, cardName: string, setName?: string): string {
    if (tcgPlayerId) {
        return `https://www.tcgplayer.com/product/${tcgPlayerId}?partner=${AFFILIATE_PARTNER_ID}`;
    }
    const query = setName ? `${cardName} ${setName}` : cardName;
    return `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(query)}&partner=${AFFILIATE_PARTNER_ID}`;
}
