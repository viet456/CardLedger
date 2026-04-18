import { PrismaClient } from '@prisma/client';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';
import crypto from 'crypto';
import zlib from 'zlib';
import { NormalizedCard, SetObject, AbilityObject, AttackObject } from '../src/shared-types/card-index';

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
const prisma = new PrismaClient();
const BUCKET_NAME = 'cardledger';

// Helper function to get or create an ID from a lookup map
function getOrCreateId<T extends string | {id: string}>(
    map: Map<string, number>,
    array: T[],
    value: T
) {
    const key = typeof value === 'string' ? value : value.id;
    if (!map.has(key)) {
        map.set(key, array.length);
        array.push(typeof value === 'string' ? value : value);
    }
    return map.get(key)!;
}

function getOrCreateAbilityId(
    map: Map<string, number>,
    array: AbilityObject[],
    value: AbilityObject
) {
    const key = value.name;
    if (!map.has(key)) {
        map.set(key, array.length);
        array.push(value);
    }
    return map.get(key)!;
}

function getOrCreateAttackId(
    map: Map<string, number>,
    array: AttackObject[],
    value: AttackObject
) {
    // Create a unique hash for the attack to deduplicate it
    const key = `${value.name}|${value.damage}|${value.text}`;
    if (!map.has(key)) {
        map.set(key, array.length);
        array.push(value);
    }
    return map.get(key)!;
}

function sanitizePublicId(id: string): string {
    const characterMap: { [key: string]: string } = { '?': 'question', '!': 'exclamation' };
    const regex = new RegExp(
        Object.keys(characterMap)
            .map((c) => `\\${c}`)
            .join('|'),
        'g'
    );
    return id.replace(regex, (match) => `_${characterMap[match]}`);
}

async function generateCardIndex() {
    console.log('Starting to build the card index artifact...');
    console.log(' -> Querying all sets and their cards from the database...');
    const allSetsFromDb = await prisma.set.findMany({
        // Sort sets by newest release date
        // Tie-breaker: bigger sets first (puts main sets before promos of the same day)
        orderBy: [{ releaseDate: 'desc' }, { total: 'desc' }],
        select: {
            id: true,
            name: true,
            total: true,
            printedTotal: true,
            logoImageKey: true,
            symbolImageKey: true,
            series: true,
            releaseDate: true,
            ptcgoCode: true,
            // Fetch all cards belonging to this set
            cards: {
                select: {
                    id: true,
                    name: true,
                    number: true,
                    hp: true,
                    convertedRetreatCost: true,
                    supertype: true,
                    artist: { select: { name: true } },
                    rarity: { select: { name: true } },
                    types: { select: { type: { select: { name: true } } } },
                    subtypes: { select: { subtype: { select: { name: true } } } },
                    weaknesses: { select: { type: { select: { name: true } }, value: true } },
                    resistances: { select: { type: { select: { name: true } }, value: true } },
                    imageKey: true,
                    releaseDate: true,
                    pokedexNumberSort: true,
                    abilities: true,
                    hasNormal: true,
                    hasHolo: true,
                    hasReverse: true,
                    hasFirstEdition: true,
                    description: true,
                    rules: true,
                    evolvesFrom: true,
                    evolvesTo: true,
                    standard: true,
                    expanded: true,
                    unlimited: true,
                    nationalPokedexNumbers: true,
                    ancientTraitName: true,
                    ancientTraitText: true,
                    attacks: {
                        select: {
                            name: true,
                            damage: true,
                            text: true,
                            cost: { select: { type: { select: { name: true } } } }
                        }
                    }
                
                }
            }
        }
    });
    const normalizedCards: NormalizedCard[] = [];
    console.log(` -> Found ${allSetsFromDb.length} sets to process.`);

    // Create lookup tables and maps to hold the unique values and their integer IDs.
    const nameMap = new Map<string, number>();
    const names: string[] = [];

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

    const abilityMap = new Map<string, number>();
    const abilities: AbilityObject[] = [];

    const ruleMap = new Map<string, number>();
    const rules: string[] = [];

    const attackMap = new Map<string, number>();
    const attacks: AttackObject[] = [];

    // Post-process the cards for the client by pruning and flattening
    for (const set of allSetsFromDb) {
        // Register the set in your global lookup map
        const setId = getOrCreateId(setMap, sets, {
            id: set.id,
            name: set.name,
            total: set.total,
            printedTotal: set.printedTotal,
            logoImageKey: set.logoImageKey,
            symbolImageKey: set.symbolImageKey,
            series: set.series,
            ptcgoCode: set.ptcgoCode,
            releaseDate: set.releaseDate.toISOString().split('T')[0]
        });

        // Sort the cards ONLY for this specific set
        set.cards.sort((a, b) => {
            const numA = parseInt(a.number, 10);
            const numB = parseInt(b.number, 10);
            const aIsNum = !isNaN(numA);
            const bIsNum = !isNaN(numB);

            if (aIsNum && bIsNum) return numA - numB; // numeric vs numeric
            if (aIsNum) return -1; // numeric before non-numeric
            if (bIsNum) return 1;
            return a.number.localeCompare(b.number, undefined, { numeric: true }); // string fallback
        });

        // Normalize the cards and push them to the final flat array
        for (const card of set.cards) {
            const nameId = getOrCreateId(nameMap, names, card.name);
            const evolvesFromId = card.evolvesFrom ? getOrCreateId(nameMap, names, card.evolvesFrom) : null;
            const evolvesToIds = card.evolvesTo.map(name => getOrCreateId(nameMap, names, name));

            const supertypeId = getOrCreateId(supertypeMap, supertypes, card.supertype);
            const artistId = card.artist
                ? getOrCreateId(artistMap, artists, card.artist.name)
                : null;
            const rarityId = card.rarity
                ? getOrCreateId(rarityMap, rarities, card.rarity.name)
                : null;
            const typeIds = card.types.map((t) => getOrCreateId(typeMap, types, t.type.name));
            const subtypeIds = card.subtypes.map((s) =>
                getOrCreateId(subtypeMap, subtypes, s.subtype.name)
            );

            const weaknessObjects = card.weaknesses.map((w) => ({
                t: getOrCreateId(typeMap, types, w.type.name),
                v: w.value
            }));
            const resistanceObjects = card.resistances.map((r) => ({
                t: getOrCreateId(typeMap, types, r.type.name),
                v: r.value
            }));

            const abilityIds = card.abilities.map((ability) =>
                getOrCreateAbilityId(abilityMap, abilities, {
                    name: ability.name,
                    text: ability.text,
                    type: ability.type
                })
            );

            const ruleIds = card.rules.map(r => getOrCreateId(ruleMap, rules, r));
            
            // Map the attacks
            const attackIds = card.attacks.map(a => getOrCreateAttackId(attackMap, attacks, {
                name: a.name,
                damage: a.damage,
                text: a.text,
                cost: a.cost.map(c => c.type.name)
            }));

            // Push to our flat array
            normalizedCards.push({
                id: card.id,
                n: nameId,
                hp: card.hp,
                num: card.number,
                img: card.imageKey,
                pS: card.pokedexNumberSort,
                cRC: card.convertedRetreatCost,
                st: supertypeId,
                a: artistId,
                r: rarityId,
                s: setId,
                t: typeIds,
                sb: subtypeIds,
                w: weaknessObjects,
                rs: resistanceObjects,
                ab: abilityIds,
                hasNormal: card.hasNormal,
                hasHolo: card.hasHolo,
                hasReverse: card.hasReverse,
                hasFirstEdition: card.hasFirstEdition,
                d: card.description,
                ru: ruleIds,
                ak: attackIds,
                eF: evolvesFromId,
                eT: evolvesToIds,
                leg: {
                    s: (card.standard as string) || undefined,
                    e: (card.expanded as string) || undefined,
                    u: (card.unlimited as string) || undefined
                },
                pdx: card.nationalPokedexNumbers.length > 0 ? card.nationalPokedexNumbers : null,
                aT: card.ancientTraitName ? { n: card.ancientTraitName, t: card.ancientTraitText || '' } : null,
            });
        }
    }
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
        abilities: abilities,
        rules: rules,
        attacks: attacks,
        names: names,
        cards: normalizedCards
    };
    const jsonData = JSON.stringify(finalJsonObject);
    console.log(` -> RAW JSON size: ${(Buffer.byteLength(jsonData) / 1024 / 1024).toFixed(2)} MB`);
    const compressedData = zlib.brotliCompressSync(jsonData);

    // Browser automatically decompresses brotli files,
    // so we derive checksum off the original JSON file
    const checkSum = crypto.createHash('sha256').update(jsonData).digest('hex');
    const artifactFileName = `card-index.v${version}.json.br`;

    console.log(` -> Final JSON size: ${(compressedData.length / 1024 / 1024).toFixed(2)} MB`);
    console.log(` -> Generated version: ${version}, checksum: ${checkSum.substring(0, 12)}...`);

    console.log(` -> Uploading main artifact to R2: ${artifactFileName}`);
    const putArtifactCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `indices/${artifactFileName}`,
        Body: compressedData,
        ContentType: 'application/json',
        ContentEncoding: 'br',
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
        ContentType: 'application/json',
        CacheControl: 'public, max-age=300' // cache for 5 minutes
    });
    await r2.send(putPointerCommand);
    console.log(' -> ✅ Pointer file uploaded successfully');
}

async function main() {
    try {
        await generateCardIndex();
        console.log('\n-- ✅ Card index build complete! --');
    } catch (error) {
        console.error('\n❌ An error occurred during the build process:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
