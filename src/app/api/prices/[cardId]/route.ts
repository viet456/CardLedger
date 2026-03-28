import { NextResponse, NextRequest } from 'next/server';
import { getCachedPriceHistory } from '@/src/app/cards/[cardId]/data';

export async function GET(request: NextRequest, context: { params: Promise<{ cardId: string }> }) {
    const { cardId } = await context.params;
    const priceHistory = await getCachedPriceHistory(cardId);

    return NextResponse.json(priceHistory, {
        headers: {
            'Cache-Control': 'public, s-maxage=82800, stale-while-revalidate=600'
        }
    });
}
