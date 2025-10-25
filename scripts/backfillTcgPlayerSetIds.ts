import { PrismaClient } from '@prisma/client';
import axios, { AxiosError } from 'axios';

const prisma = new PrismaClient();
const POKEPRICETRACKER_KEY = process.env.POKEPRICETRACKER_KEY;
const PRICING_API_SETS_URL = 'https://www.pokemonpricetracker.com/api/v2/sets';

function formatSetNameForApi(name: string): string {
    return name
        .replace(/ & /g, ' and ') // 'Black & White' -> 'Black and White'
        .replace(/:/g, '') // 'Sun & Moon: Team Up' -> 'Sun and Moon Team Up'
        .replace(/'/g, '') // "McDonald's Collection" -> 'McDonalds Collection'
        .trim();
}

async function searchForSetId(setName: string): Promise<string | null> {
    const normalizedSetName = formatSetNameForApi(setName);
    try {
        const response = await axios.get(`${PRICING_API_SETS_URL}`, {
            headers: {
                Authorization: `Bearer ${POKEPRICETRACKER_KEY}`
            },
            params: {
                search: normalizedSetName,
                limit: 5
            },
            timeout: 10000
        });
        if (
            response.data?.data &&
            Array.isArray(response.data.data) &&
            response.data.data.length > 0
        ) {
            const results = response.data.data as {
                id: string;
                name: string;
                tcgPlayerId: string;
            }[];
            const firstResult = results[0];
            if (firstResult && firstResult.tcgPlayerId) {
                console.log(
                    `-> Using first result: "${firstResult.name}" (Returning TCGPlayer ID: ${firstResult.tcgPlayerId})`
                );
                return firstResult.tcgPlayerId;
            }
            console.log(` ❓ Found results, but first result missing 'tcgPlayerId':`, firstResult);
            return null;
        } else {
            console.log(` ❓ No results returned from API for "${setName}".`);
            return null;
        }
    } catch (error) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
            console.error(
                ` ❌ API Error searching for "${setName}": ${axiosError.response.status}`,
                axiosError.response.data
            );
        } else if (axiosError.request) {
            console.error(` ❌ Network Error searching for "${setName}": No response received.`);
        } else {
            console.error(
                ` ❌ Error setting up search request for "${setName}":`,
                axiosError.message
            );
        }
        return null;
    }
}

async function main() {
    console.log('Getting TCGplayer Set Ids');
    const setsToMap = await prisma.set.findMany({
        where: { tcgPlayerSetId: null },
        select: { id: true, name: true }
    });
    if (setsToMap.length === 0) {
        console.log('✅ All sets already have a tcgPlayerSetId. Nothing to do.');
        return null;
    }
    console.log(`Found ${setsToMap.length} sets in your database needing IDs.`);
    let updatedCount = 0;
    let notFoundCount = 0;
    const manualReviewNeeded: { name: string; reason: string }[] = [];

    for (const mySet of setsToMap) {
        const tcgPlayerId = await searchForSetId(mySet.name);
        if (tcgPlayerId) {
            try {
                await prisma.set.update({
                    where: { id: mySet.id },
                    data: { tcgPlayerSetId: tcgPlayerId }
                });
                updatedCount++;
            } catch (error) {
                console.error(
                    `   -> ❌ FAILED to update "${mySet.name}" in DB with ID ${tcgPlayerId}:`,
                    error
                );
                manualReviewNeeded.push({
                    name: mySet.name,
                    reason: `DB Update Failed (Tried ID: ${tcgPlayerId})`
                });
                notFoundCount++;
            }
        } else {
            notFoundCount++;
            manualReviewNeeded.push({ name: mySet.name, reason: 'No match found in API search' });
        }
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1s delay
    }
    console.log('\n--- Backfill Complete ---');
    console.log(`Attempted to update: ${setsToMap.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Could not find match / Failed Update: ${notFoundCount}`);
    if (manualReviewNeeded.length > 0) {
        console.log('\nSets requiring manual review/update:');
        manualReviewNeeded.forEach((item) => console.log(`  - ${item.name} (${item.reason})`));
        console.log(
            '\nInvestigate these sets. You may need to find their ID manually from the pricing API data and update `tcgPlayerSetId` using Postico or SQL.'
        );
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
