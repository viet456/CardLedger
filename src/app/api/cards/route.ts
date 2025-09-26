import { PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();
const BATCH_SIZE = 50;

// add compound sorting, filter terms via WHERE, orderBy
// add db table indexes
// http://localhost:3000/api/cards
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    // pulls cursor value xy7-25 from GET /api/cards?cursor=xy7-25
    const cursor = searchParams.get('cursor');
    try {
        const cards = await prisma.card.findMany({
            take: BATCH_SIZE,
            // If a cursor is provided from the client, we skip 1
            skip: cursor ? 1 : 0,
            // set starting point to the card of id matching cursor
            // if no cursor is provided, we're at the beginning
            cursor: cursor ? { id: cursor } : undefined,
            orderBy: {
                id: 'asc'
            }
        });
        // ID of the last card used in this batch,
        // returned to the client to use as the cursor for the next request
        const lastCardInResults = cards.length === BATCH_SIZE ? cards[BATCH_SIZE - 1] : null;
        const nextCursor = lastCardInResults ? lastCardInResults.id : null;

        return NextResponse.json({
            nextCursor,
            cards
        });
    } catch (error) {
        console.error('Failed to fetch cards:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
