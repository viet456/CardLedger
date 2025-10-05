import { PrismaClient } from '@prisma/client';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';
import crypto from 'crypto';

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
const prisma = new PrismaClient();
const BUCKET_NAME = 'cardledger';

type SetObject = { id: string; name: string; printedTotal: number };

// Helper function to get or create an ID from a lookup map
function getOrCreateId(
    map: Map<string, number>,
    array: (string | SetObject)[],
    value: string | SetObject
) {
    const key = typeof value === 'string' ? value : value.id;
    if (!map.has(key)) {
        map.set(key, array.length);
        array.push(typeof value === 'string' ? value : value);
    }
    return map.get(key)!;
}

async function buildCardIndex() {
    console.log('Starting to build the card index artifact...');
    console.log(' -> Querying all cards from the database...');
    const allCardsFromDb = await prisma.card.findMany({
        orderBy: [{ releaseDate: 'desc' }, { number: 'asc' }],
        select: {
            id: true,
            name: true,
            number: true,
            hp: true,
            convertedRetreatCost: true,
            supertype: true,
            artist: { select: { name: true } }, // Flatten relation
            rarity: { select: { name: true } }, // Flatten relation
            set: { select: { id: true, name: true, printedTotal: true } }, // Flatten relation
            types: { select: { type: { select: { name: true } } } }, // Flatten nested relation
            subtypes: { select: { subtype: { select: { name: true } } } }, // Flatten nested relation
            weaknesses: { select: { type: { select: { name: true } } } },
            resistances: { select: { type: { select: { name: true } } } },
            imageKey: true,
            releaseDate: true,
            pokedexNumberSort: true
        }
    });
    // sorts the stringed cardnumbers
    allCardsFromDb.sort((a, b) => {
        // group by releaseDate
        if (a.releaseDate.getTime() !== b.releaseDate.getTime()) {
            return b.releaseDate.getTime() - a.releaseDate.getTime();
        }
        const numA = parseInt(a.number, 10);
        const numB = parseInt(b.number, 10);
        const aIsNum = !isNaN(numA);
        const bIsNum = !isNaN(numB);

        if (aIsNum && bIsNum) return numA - numB; // numeric vs numeric
        if (aIsNum) return -1; // numeric before non-numeric
        if (bIsNum) return 1;
        return a.number.localeCompare(b.number); // string fallback
    });
    console.log(` -> Found ${allCardsFromDb.length} cards to process.`);

    // Create lookup tables and maps to hold the unique values and their integer IDs.
    const supertypeMap = new Map<string, number>();
    const supertypes: string[] = [];

    const rarityMap = new Map<string, number>();
    const rarities: string[] = [];

    const setMap = new Map<string, number>();
    const sets: SetObject[] = [];

    const typeMap = new Map<string, number>();
    const types: string[] = [];

    const subtypeMap = new Map<string, number>();
    const subtypes: string[] = [];

    const artistMap = new Map<string, number>();
    const artists: string[] = [];

    // Post-process the cards for the client by pruning and flattening
    const normalizedCards = allCardsFromDb.map((card) => {
        const supertypeId = getOrCreateId(supertypeMap, supertypes, card.supertype);
        const artistId = card.artist ? getOrCreateId(artistMap, artists, card.artist.name) : null;
        const rarityId = card.rarity ? getOrCreateId(rarityMap, rarities, card.rarity.name) : null;
        const setId = getOrCreateId(setMap, sets, card.set);

        const typeIds = card.types.map((t) => getOrCreateId(typeMap, types, t.type.name));
        const subtypeIds = card.subtypes.map((s) =>
            getOrCreateId(subtypeMap, subtypes, s.subtype.name)
        );
        const weaknessIds = card.weaknesses.map((w) => getOrCreateId(typeMap, types, w.type.name));
        const resistanceIds = card.resistances.map((r) =>
            getOrCreateId(typeMap, types, r.type.name)
        );
        // Return a compact card object with short keys and integer IDs
        return {
            id: card.id,
            n: card.name,
            hp: card.hp,
            num: card.number,
            img: card.imageKey,
            rD: card.releaseDate.toISOString().split('T')[0],
            pS: card.pokedexNumberSort,
            cRC: card.convertedRetreatCost,
            st: supertypeId,
            a: artistId,
            r: rarityId,
            s: setId,
            t: typeIds,
            sb: subtypeIds,
            w: weaknessIds,
            rs: resistanceIds
        };
    });
    console.log(` -> Processed and normalized ${normalizedCards.length} cards.`);

    // Generate version and its checksum
    const version = new Date().toISOString().replace(/[-:.]/g, '');
    const finalJsonObject = {
        version: version,
        supertypes: supertypes,
        rarities: rarities,
        sets: sets,
        types: types,
        subtypes: subtypes,
        artists: artists,
        cards: normalizedCards
    };
    const jsonData = JSON.stringify(finalJsonObject);
    const checkSum = crypto.createHash('sha256').update(jsonData).digest('hex');
    const artifactFileName = `card-index.v${version}.json`;
    console.log(` -> Final JSON size: ${(jsonData.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(` -> Generated version: ${version}, checksum: ${checkSum.substring(0, 12)}...`);

    console.log(` -> Uploading main artifact to R2: ${artifactFileName}`);
    const putArtifactCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `indices/${artifactFileName}`,
        Body: jsonData,
        ContentType: 'applications/json',
        CacheControl: 'public, max-age=31536000, immutable' // Cache for 1 year, never changes
    });
    await r2.send(putArtifactCommand);
    console.log(' -> ✅ Main artifact uploaded successfully');

    const pointerFile = {
        version: version,
        url: `${R2_PUBLIC_URL}/indices/${artifactFileName}`,
        checkSum: checkSum,
        cardCount: normalizedCards.length,
        updatedAt: new Date().toISOString()
    };
    const pointerFileName = 'card-index.current.json';
    console.log(`-> Uploading pointer file to R2: ${pointerFileName}`);
    const putPointerCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `indices/${pointerFileName}`,
        Body: JSON.stringify(pointerFile),
        ContentType: 'applications/json',
        CacheControl: 'public, max-age=300' // cache for 5 minutes
    });
    await r2.send(putPointerCommand);
    console.log(' -> ✅ Pointer file uploaded successfully');
}

async function main() {
    try {
        await buildCardIndex();
        console.log('\n-- ✅ Card index build complete! --');
    } catch (error) {
        console.error('\n❌ An error occurred during the build process:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
