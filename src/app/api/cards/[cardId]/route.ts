import { NextResponse, NextRequest } from 'next/server';
import { getCardData, getPriceHistory } from '@/src/app/cards/[cardId]/data';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ cardId: string }> }) {
    const { cardId } = await context.params;
    const [card, priceHistory] = await Promise.all([getCardData(cardId), getPriceHistory(cardId)]);

    if (!card) {
        return new NextResponse(JSON.stringify({ message: 'Card not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    return NextResponse.json({ card, priceHistory });
}
