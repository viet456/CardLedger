import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import {
    PriceHistoryDbRow,
    ApiCard,
    conditionsMarketMap,
    conditionsVolumeMap
} from '../src/shared-types/price-api';

const prisma = new PrismaClient();
const POKEPRICETRACKER_KEY = process.env.POKEPRICETRACKER_KEY;
const API_BASE_URL = 'https://www.pokemonpricetracker.com/api/v2/cards';

// TARGETS
const DB_CARD_ID = 'swsh7-215';
const API_TCG_ID = '246723';

async function processAndWriteHistory(myCardId: string, apiCard: ApiCard) {
    if (!apiCard.priceHistory) {
        console.error(`❌ API returned card data, but 'priceHistory' is missing.`);
        return;
    }

    const entriesByDate = new Map<string, Partial<PriceHistoryDbRow>>();
    const conditions = [
        'Near Mint',
        'Lightly Played',
        'Moderately Played',
        'Heavily Played',
        'Damaged'
    ];

    let points = 0;
    for (const condition of conditions) {
        const history = apiCard.priceHistory.conditions[condition]?.history;
        if (!history || history.length === 0) continue;

        const marketKey = conditionsMarketMap[condition];
        const volumeKey = conditionsVolumeMap[condition];
        if (!marketKey || !volumeKey) continue;

        for (const item of history) {
            const dateString = item.date;
            if (!entriesByDate.has(dateString)) {
                entriesByDate.set(dateString, { timestamp: new Date(dateString) });
            }
            const row = entriesByDate.get(dateString)!;
            const market = parseFloat(String(item.market));
            const volume = item.volume !== null ? parseInt(String(item.volume), 10) : null;

            if (!isNaN(market)) row[marketKey] = market;
            if (volume !== null && !isNaN(volume)) row[volumeKey] = volume;
            points++;
        }
    }

    console.log(`   > Found ${points} history points.`);
    const dataForPrisma: PriceHistoryDbRow[] = Array.from(entriesByDate.values()).map((row) => ({
        cardId: myCardId,
        timestamp: row.timestamp!,
        tcgNearMint: row.tcgNearMint ?? null,
        tcgLightlyPlayed: row.tcgLightlyPlayed ?? null,
        tcgModeratelyPlayed: row.tcgModeratelyPlayed ?? null,
        tcgHeavilyPlayed: row.tcgHeavilyPlayed ?? null,
        tcgDamaged: row.tcgDamaged ?? null,
        tcgNearMintVolume: row.tcgNearMintVolume ?? null,
        tcgLightlyPlayedVolume: row.tcgLightlyPlayedVolume ?? null,
        tcgModeratelyPlayedVolume: row.tcgModeratelyPlayedVolume ?? null,
        tcgHeavilyPlayedVolume: row.tcgHeavilyPlayedVolume ?? null,
        tcgDamagedVolume: row.tcgDamagedVolume ?? null
    }));

    if (dataForPrisma.length > 0) {
        for (const row of dataForPrisma) {
            await prisma.priceHistory.upsert({
                where: { cardId_timestamp: { cardId: row.cardId, timestamp: row.timestamp } },
                update: row,
                create: row
            });
        }
        console.log(`✅ SUCCESS: History written to DB.`);
    }

    // Update Market Stats
    const prices = apiCard.prices?.conditions;
    await prisma.marketStats.upsert({
        where: { cardId: myCardId },
        update: {
            tcgNearMintLatest: prices?.['Near Mint']?.price,
            tcgPlayerUpdatedAt: new Date()
        },
        create: {
            cardId: myCardId,
            tcgNearMintLatest: prices?.['Near Mint']?.price,
            tcgPlayerUpdatedAt: new Date()
        }
    });
    console.log(`✅ SUCCESS: Market Stats updated.`);
}

async function main() {
    console.log(`🚀 FORCE BACKFILL: Umbreon VMAX (Targeting TCG ID: ${API_TCG_ID})...`);

    const dbCard = await prisma.card.findUnique({
        where: { id: DB_CARD_ID }
    });

    if (!dbCard) {
        console.error(`❌ Card '${DB_CARD_ID}' not found in DB.`);
        return;
    }
    console.log(`✅ DB Card Found: ${dbCard.name}`);

    console.log(`⬇️ Fetching specific card from API...`);
    const response = await axios.get(API_BASE_URL, {
        headers: { Authorization: `Bearer ${POKEPRICETRACKER_KEY}` },
        params: {
            tcgPlayerId: API_TCG_ID,
            includeHistory: true,
            days: 9999
        }
    });

    if (!response.data?.data) {
        console.error('❌ API returned no data for this ID.');
        return;
    }

    let apiCard: ApiCard;
    if (Array.isArray(response.data.data)) {
        apiCard = response.data.data[0];
    } else {
        apiCard = response.data.data;
    }

    if (!apiCard) {
        console.error('❌ Could not extract card data from response.');
        return;
    }

    console.log(`✅ API Card Found: ${apiCard.name} (#${apiCard.cardNumber})`);

    await processAndWriteHistory(dbCard.id, apiCard);
}

main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
