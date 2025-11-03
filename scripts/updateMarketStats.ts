import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { ApiCard } from '../src/shared-types/price-api';

const POKEPRICETRACKER_KEY = process.env.POKEPRICETRACKER_KEY;
const prisma = new PrismaClient();
const API_BASE_URL = 'https://www.pokemonpricetracker.com/api/v2/cards/';

function normalizePokemonName(name: string): string {
    return (
        name
            .toLowerCase()
            .replace(/lv\.x/g, 'level x') // Handle Lv.X variations
            .replace(/ ★/g, ' star') // Handle Star symbol
            .replace(/ δ/g, ' delta species') // Handle Delta Species symbol
            // Remove accents
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s]|_/g, '') // Remove punctuation except spaces
            .replace(/\s+/g, ' ') // Collapse multiple spaces
            .trim()
    );
}

async function getSetPrices(setId: string) {
    try {
        const response = await axios.get(`${API_BASE_URL}`, {
            headers: {
                Authorization: `Bearer ${POKEPRICETRACKER_KEY}`
            },
            params: {
                setId: `${setId}`,
                fetchAllInSet: true
            },
            timeout: 60000
        });
        return response.data;
    } catch (error) {
        console.error(` ❌ FAILED to fetch data for ${setId}`, error.message);
        return null;
    }
}

async function upsertCardMarketStats(myCardId: string, apiCard: ApiCard) {
    const prices = apiCard.prices?.conditions;
    const latestNearMintPrice = prices?.['Near Mint']?.price;
    const latestLightlyPlayedPrice = prices?.['Lightly Played']?.price;
    const latestModeratelyPlayedPrice = prices?.['Moderately Played']?.price;
    const latestHeavilyPlayedPrice = prices?.['Heavily Played']?.price;
    const latestDamagedPrice = prices?.['Damaged']?.price;
    const tcgLastUpdatedAt = apiCard.prices?.lastUpdated;
    const validTcgUpdatedAt = tcgLastUpdatedAt ? new Date(tcgLastUpdatedAt) : undefined;

    if (latestNearMintPrice === null || latestNearMintPrice === undefined) {
        return;
    }
    try {
        await prisma.marketStats.upsert({
            where: { cardId: myCardId },
            update: {
                tcgNearMintLatest: latestNearMintPrice,
                tcgLightlyPlayedLatest: latestLightlyPlayedPrice,
                tcgModeratelyPlayedLatest: latestModeratelyPlayedPrice,
                tcgHeavilyPlayedLatest: latestHeavilyPlayedPrice,
                tcgDamagedLatest: latestDamagedPrice,
                tcgPlayerUpdatedAt: validTcgUpdatedAt
            },
            create: {
                cardId: myCardId,
                tcgNearMintLatest: latestNearMintPrice,
                tcgLightlyPlayedLatest: latestLightlyPlayedPrice,
                tcgModeratelyPlayedLatest: latestModeratelyPlayedPrice,
                tcgHeavilyPlayedLatest: latestHeavilyPlayedPrice,
                tcgDamagedLatest: latestDamagedPrice,
                tcgPlayerUpdatedAt: validTcgUpdatedAt ?? new Date()
            }
        });
    } catch (error) {
        console.error(` ❌ FAILED to upsert MarketStats for ${myCardId}:`, error.message);
    }
}

async function main() {
    let failCount = 0;
    const MAX_FAILS = 3;
    const dbSets = await prisma.set.findMany({
        select: {
            id: true,
            tcgPlayerSetId: true,
            name: true
        },
        orderBy: {
            releaseDate: 'desc'
        }
    });
    // Fetch half of our sets alternating, always get latest set
    const latestSet = dbSets[0];
    const dayOfMonth = new Date().getDate();
    const isEvenDay = dayOfMonth % 2 === 0;
    const alternatingSets = dbSets.filter((_, index) => {
        return (index % 2 === 0) === isEvenDay;
    });
    isEvenDay ? console.log('Fetching even sets') : console.log('Fetching odd sets');
    const setsToProcessMap = new Map(alternatingSets.map((set) => [set.id, set]));
    if (latestSet) {
        setsToProcessMap.set(latestSet.id, latestSet);
    }
    const setsToProcess = Array.from(setsToProcessMap.values());

    console.log(`Starting daily MarketStats update for ${dbSets.length} sets...`);

    for (const set of setsToProcess) {
        if (!set.tcgPlayerSetId) {
            console.log(`Skipping set ${set.name} (missing tcgPlayerSetId)`);
            continue;
        }
        console.log(`Processing set: ${set.name} (${set.id})`);

        const dbCards = await prisma.card.findMany({
            where: {
                setId: set.id
            },
            select: {
                id: true,
                number: true,
                name: true
            }
        });

        const pageData = await getSetPrices(set.tcgPlayerSetId);
        if (!pageData) {
            console.log(` -> Skipping set ${set.name} due to API fetch failure.`);
            failCount++;
            if (failCount >= MAX_FAILS) {
                console.error(
                    `\n❌ CRITICAL: Hit ${failCount} consecutive API failures. Halting script to avoid ban.`
                );
                process.exit(1);
            }
            break;
        }
        failCount = 0;

        const apiCards: ApiCard[] = pageData.data;

        for (const apiCard of apiCards) {
            const apiCardNumberRaw = String(apiCard.cardNumber);
            const normalizedApiNumberString = apiCardNumberRaw.replace(/^0+/, '');
            const apiCardName = apiCard.name;
            const normalizedApiCardName = normalizePokemonName(apiCardName);
            const myCard = dbCards.find((c) => c.number.endsWith(normalizedApiNumberString));

            let cardMatchIsValid = false;

            if (!myCard) {
                console.log(
                    ` - ℹ️  No match found for API card number: ${apiCardNumberRaw} (${apiCardName})`
                );
                continue;
            }
            const normalizedDbCardName = normalizePokemonName(myCard.name);
            if (
                normalizedDbCardName.includes(normalizedApiCardName) ||
                normalizedApiCardName.includes(normalizedDbCardName)
            ) {
                console.log(
                    ` ✅ Match found! DB: ${myCard.number} (${myCard.name}), API: ${apiCardNumberRaw} (${apiCardName})`
                );
                cardMatchIsValid = true;
            } else {
                // Number match but names don't
                console.log(
                    `  - ⚠️  Number match (${myCard.number} ends with ${normalizedApiNumberString}), but normalized names differ! DB_norm: '${normalizedDbCardName}', API_norm: '${normalizedApiCardName}'. Skipping.`
                );
            }
            if (!cardMatchIsValid) {
                continue;
            }
            try {
                await upsertCardMarketStats(myCard!.id, apiCard);
            } catch (error) {
                console.error(
                    `❌ Error processing history write for card ${apiCard.cardNumber} (${apiCardName}) in set ${set.name}:`,
                    error
                );
            }
        }
        const waitTime = 31;
        console.log(`Waiting ${waitTime} seconds`);
        await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));

        console.log(` -> Finished processing set: ${set.name}.`);
    }
    console.log('✅ Daily MarketStats update complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
