import { PrismaClient } from '../src/generated/prisma/index.js';
import fetch, { RequestInit, Response } from 'node-fetch';
import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';
import { z } from 'zod';
// Note: refactor to use Axios

const prisma = new PrismaClient();
const BUCKET_NAME = 'cardledger';

// Zod validators and schemas
const ApiAbilitySchema = z.object({
    name: z.string(),
    text: z.string(),
    type: z.string()
});

const ApiAttackSchema = z.object({
    name: z.string(),
    cost: z.array(z.string()),
    convertedEnergyCost: z.number(),
    damage: z.string().optional(),
    text: z.string().optional()
});

const ApiWeaknessSchema = z.object({
    type: z.string(),
    value: z.string().optional()
});

const ApiResistanceSchema = z.object({
    type: z.string(),
    value: z.string().optional()
});

const ApiLegalitySchema = z.object({
    standard: z.enum(['Legal', 'Banned']).optional(),
    expanded: z.enum(['Legal', 'Banned']).optional(),
    unlimited: z.enum(['Legal', 'Banned']).optional()
});

const ApiCardSchema = z.object({
    id: z.string(),
    name: z.string(),
    supertype: z.enum(['Pokémon', 'Trainer', 'Energy']),
    subtypes: z.array(z.string()).optional(),
    hp: z.string().optional(),
    types: z.array(z.string()).optional(),
    evolvesFrom: z.string().optional(),
    evolvesTo: z.array(z.string()).optional(),

    abilities: z.array(ApiAbilitySchema).optional(),
    attacks: z.array(ApiAttackSchema).optional(),
    weaknesses: z.array(ApiWeaknessSchema).optional(),
    resistances: z.array(ApiResistanceSchema).optional(),
    convertedRetreatCost: z.number().optional(),

    rules: z.array(z.string()).optional(),
    ancientTraitName: z.string().optional(),
    ancientTraitText: z.string().optional(),
    number: z.string(),
    artist: z.string().optional(),
    rarity: z.string().optional(),
    nationalPokedexNumbers: z.array(z.number()).optional(),

    legalities: ApiLegalitySchema.optional(),

    images: z
        .object({
            small: z.string(),
            large: z.string()
        })
        .optional()
});

const ApiSetSchema = z.object({
    id: z.string(),
    name: z.string(),
    series: z.string(),
    printedTotal: z.number(),
    total: z.number(),
    ptcgoCode: z.string().optional(),
    releaseDate: z.coerce.date(),
    updatedAt: z.coerce.date(),
    images: z.object({
        symbol: z.string(),
        logo: z.string()
    })
});

const ApiSetResponseSchema = z.object({
    data: z.array(ApiSetSchema)
});

const ApiCardResponseSchema = z.object({
    data: z.array(ApiCardSchema)
});

const ApiStringsResponseSchema = z.object({
    data: z.array(z.string())
});

// Types
type ApiAbility = z.infer<typeof ApiAbilitySchema>;
type ApiAttack = z.infer<typeof ApiAttackSchema>;
type ApiWeakness = z.infer<typeof ApiWeaknessSchema>;
type ApiResistance = z.infer<typeof ApiResistanceSchema>;
type ApiCard = z.infer<typeof ApiCardSchema>;
type ApiSet = z.infer<typeof ApiSetSchema>;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetries(
    url: string,
    options: RequestInit,
    retries: number = 3,
    initialDelay: number = 5000
): Promise<Response | null> {
    let currentDelay = initialDelay;
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok || (response.status >= 400 && response.status < 500)) {
                return response;
            }
            console.log(
                ` -> Server error (${response.status}). Retrying in ${currentDelay / 1000}s... (Attempt ${i + 1}/${retries})`
            );
        } catch (error) {
            console.log(
                ` -> Network error. Retrying in ${currentDelay / 1000}s... (Attempt ${i + 1}/${retries})`
            );
        }
        await delay(currentDelay);
        currentDelay *= 2; // Double the delay for the next attempt
    }
    console.error(` -> ❌ All ${retries} retry attempts failed for URL: ${url}`);
    return null;
}

async function doesImageExistInR2(key: string): Promise<boolean> {
    try {
        const command = new HeadObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });
        await r2.send(command);
        return true;
    } catch (error) {
        if (error instanceof Error && error.name === 'NotFound') {
            return false;
        }
        console.error(`Error checking image existence for key ${key}`, error);
        return false;
    }
}

async function uploadImageToR2(
    imageUrl: string,
    key: string
): Promise<{ key: string | null; isHardFailure: boolean }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
        console.log(` -> Fetching image from URL: ${imageUrl}`);
        const response = await fetch(imageUrl, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            if (response.status === 404) {
                console.log(` -> Image not found at source (404). Skipping.`);
                return { key: null, isHardFailure: false };
            }
            console.log(`Failed to fetch image: ${response.statusText}`);
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const imageBuffer = Buffer.from(await response.arrayBuffer());
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: imageBuffer,
            ContentType: response.headers.get('content-type') || 'image/png'
        });
        console.log(` -> Uploading image to R2 with key: ${key}`);
        await r2.send(command);
        console.log(` -> ✅ Successfully uploaded image: ${key}`);
        return { key: key, isHardFailure: false };
    } catch (error) {
        console.error(` -> ❌ Error in uploading/verifing image for key ${key}:`, error);
        return { key: null, isHardFailure: true };
    } finally {
        clearTimeout(timeoutId);
    }
}

async function seedMasterData() {
    console.log('Seeding master data...');
    // Seeds the types and subtypes tables
    try {
        // Get types and subtypes lists from API
        console.log(' -> Fetching types...');
        const typesResponse = await fetchWithRetries('https://api.pokemontcg.io/v2/types', {
            headers: { 'X-Api-Key': process.env.POKEMONTCG_API_KEY! }
        });
        // Fail-fast check for types
        if (!typesResponse || !typesResponse.ok) {
            throw new Error('API error when fetching types.');
        }

        console.log(' -> Fetching subtypes...');
        const subtypesResponse = await fetchWithRetries('https://api.pokemontcg.io/v2/subtypes', {
            headers: { 'X-Api-Key': process.env.POKEMONTCG_API_KEY! }
        });
        // Fail-fast check for subtypes
        if (!subtypesResponse || !subtypesResponse.ok) {
            throw new Error('API error when fetching subtypes.');
        }

        const { data: pokemonTypes } = ApiStringsResponseSchema.parse(await typesResponse.json());
        const { data: pokemonSubtypes } = ApiStringsResponseSchema.parse(
            await subtypesResponse.json()
        );

        // Write types tables in DB
        await prisma.$transaction([
            prisma.type.createMany({
                data: pokemonTypes.map((name) => ({ name })),
                skipDuplicates: true
            }),
            prisma.subtype.createMany({
                data: pokemonSubtypes.map((name) => ({ name })),
                skipDuplicates: true
            })
        ]);
    } catch (error) {
        console.error('❌❌ Failed to seed master data from API:', error);
        process.exit(1);
    }
    console.log('Master data seeded');
}

// Create lookup maps
async function prepareLookups(): Promise<{
    typeNameToIdMap: Map<string, number>;
    subtypeNameToIdMap: Map<string, number>;
}> {
    const [allTypes, subTypes] = await Promise.all([
        prisma.type.findMany(),
        prisma.subtype.findMany()
    ]);
    const typeNameToIdMap = new Map<string, number>();
    for (const type of allTypes) {
        typeNameToIdMap.set(type.name, type.id);
    }
    const subtypeNameToIdMap = new Map<string, number>();
    for (const subtype of subTypes) {
        subtypeNameToIdMap.set(subtype.name, subtype.id);
    }
    return { typeNameToIdMap, subtypeNameToIdMap };
}

async function syncSets() {
    console.log('-- Syncing sets -- ');
    // Ensure sets exist in our database

    try {
        const setsResponse = await fetchWithRetries('https://api.pokemontcg.io/v2/sets', {
            headers: { 'X-Api-Key': process.env.POKEMONTCG_API_KEY! }
        });
        if (!setsResponse) {
            throw new Error('Failed to fetch sets from API after multiple retries. Aborting.');
        }
        if (!setsResponse.ok) {
            // Client side errors
            throw new Error(`API error when fetching sets: ${setsResponse.statusText}`);
        }
        const setsInDb = await prisma.set.findMany({
            select: {
                id: true,
                total: true,
                _count: {
                    select: { cards: true }
                }
            }
        });
        const setsInDbMap = new Map();
        for (const set of setsInDb) {
            setsInDbMap.set(set.id, set);
        }
        const responseText = await setsResponse.text();
        let setsData: ApiSet[];
        try {
            const jsonData = JSON.parse(responseText);
            setsData = ApiSetResponseSchema.parse(jsonData).data;
        } catch (parseError) {
            console.error('❌❌ Failed to parse API Set response as JSON. Server response:');
            console.error(responseText);
            throw parseError;
        }
        const setPromises = setsData.map(async (apiSet) => {
            // Check if set already exists in db
            const existingSet = setsInDbMap.get(apiSet.id);
            if (!existingSet) {
                console.log(`Creating new set: ${apiSet.name}`);

                // Upload set images
                const [symbolUploadResult, logoUploadResult] = await Promise.all([
                    uploadImageToR2(apiSet.images.symbol, `sets/${apiSet.id}-symbol.png`),
                    uploadImageToR2(apiSet.images.logo, `sets/${apiSet.id}-logo.png`)
                ]);

                await prisma.set.create({
                    data: {
                        id: apiSet.id,
                        name: apiSet.name,
                        series: apiSet.series,
                        printedTotal: apiSet.printedTotal,
                        total: apiSet.total,
                        ptcgoCode: apiSet.ptcgoCode,
                        releaseDate: new Date(apiSet.releaseDate),
                        updatedAt: new Date(apiSet.updatedAt),
                        symbolImageKey: symbolUploadResult.key,
                        logoImageKey: logoUploadResult.key
                    }
                });
            } else if (existingSet.total !== apiSet.total) {
                console.log(
                    `Updating set ${apiSet.name}: total changed from ${existingSet.total} to ${apiSet.total}`
                );
                await prisma.set.update({
                    where: { id: apiSet.id },
                    data: { total: apiSet.total }
                });
            }
        });
        await Promise.all(setPromises);
    } catch (error) {
        console.error('❌❌ An error occured during set synchronization: ', error);
        process.exit(1);
    }
    console.log('Set sync complete');
}

async function syncCards(
    typeNameToIdMap: Map<string, number>,
    subtypeNameToIdMap: Map<string, number>
) {
    console.log('-- Syncing cards sequentially --');

    // Cancel image uploads when bucket loses connection
    let consecutiveUploadFailures = 0;
    const FAILURE_THRESHOLD = 5;
    let imageUploadsDisabled = false;

    // Fetch all sets from the database
    const allSetsInDb = await prisma.set.findMany({
        select: {
            id: true,
            total: true,
            name: true,
            _count: { select: { cards: true } }
        }
    });

    // Sets missing cards or imageKeys
    const setsMissingCards = allSetsInDb.filter((dbSet) => dbSet._count.cards < dbSet.total);
    const setsMissingImages = await prisma.set.findMany({
        where: {
            cards: {
                some: {
                    imageKey: null
                }
            }
        },
        include: {
            _count: {
                select: {
                    cards: true
                }
            }
        }
    });
    // Determine which sets need to be synced
    const incompleteSetsMap = new Map();
    for (const set of setsMissingCards) {
        incompleteSetsMap.set(set.id, set);
    }
    for (const set of setsMissingImages) {
        incompleteSetsMap.set(set.id, set);
    }
    const incompleteSets = Array.from(incompleteSetsMap.values());

    if (incompleteSets.length === 0) {
        console.log('All sets are up to date. Card sync complete.');
        return;
    }

    console.log(`Found ${incompleteSets.length} incomplete sets. Processing one at a time...`);

    // Process each incomplete set sequentially
    for (const dbSet of incompleteSets) {
        console.log(`- Fetching cards for set: ${dbSet.name} -`);
        // Create a card item from the set
        try {
            const cardsResponse = await fetchWithRetries(
                `https://api.pokemontcg.io/v2/cards?q=set.id:${dbSet.id}`,
                { headers: { 'X-Api-Key': process.env.POKEMONTCG_API_KEY! } }
            );

            if (!cardsResponse) {
                console.error(`> ❌ Skipping set ${dbSet.name} after all retries failed.`);
                continue; // Skip to the next set
            }

            // Check for API errors before parsing JSON
            if (!cardsResponse.ok) {
                console.error(`> ❌ API error for set ${dbSet.name}: ${cardsResponse.statusText}`);
                continue; // Skip to the next set
            }
            const { data: cardsData } = ApiCardResponseSchema.parse(await cardsResponse.json());

            // Fetch cards in the DB with their imageKey status
            const existingCardsInDb = await prisma.card.findMany({
                where: { setId: dbSet.id },
                select: { id: true, imageKey: true }
            });
            const existingCardsMap = new Map(existingCardsInDb.map((c) => [c.id, c]));
            console.log(`- Syncing ${cardsData.length} cards for set ${dbSet.name} -`);

            // Use a for loop to process and insert cards one at a time, to handle image uploads sequentially
            for (const apiCard of cardsData) {
                const existingCard = existingCardsMap.get(apiCard.id);

                if (!existingCard) {
                    // Create new card
                    // Upload card image from API to the bucket
                    let imageKey: string | null = null;
                    if (apiCard.images?.large && !imageUploadsDisabled) {
                        const key = `cards/${apiCard.id}.png`;
                        console.log(` -> Checking for image in R2: ${key}`);
                        const imageExists = await doesImageExistInR2(key);
                        if (!imageExists) {
                            const uploadResult = await uploadImageToR2(apiCard.images.large, key);
                            imageKey = uploadResult.key;

                            if (uploadResult.isHardFailure) {
                                consecutiveUploadFailures++;
                                console.log(
                                    ` -> ⚠️ Upload failed. Consecutive failures: ${consecutiveUploadFailures}`
                                );
                            } else {
                                // Reset the counter on a successful upload
                                consecutiveUploadFailures = 0;
                            }
                        } else {
                            console.log(` -> Image already exists in R2. Skipping upload.`);
                            imageKey = key;
                            consecutiveUploadFailures = 0;
                        }
                    }

                    try {
                        console.log(` -> Inserting card ${apiCard.name} into database.`);
                        await prisma.card.create({
                            data: {
                                id: apiCard.id,
                                name: apiCard.name,
                                supertype: apiCard.supertype,
                                subtypes: {
                                    create: (apiCard.subtypes || []).flatMap((subtypeName) => {
                                        const subtypeId = subtypeNameToIdMap.get(subtypeName);
                                        return subtypeId ? [{ subtypeId: subtypeId }] : [];
                                    })
                                },
                                hp: apiCard.hp ? parseInt(apiCard.hp, 10) : null,
                                types: {
                                    create: (apiCard.types || []).flatMap((typeName) => {
                                        const typeId = typeNameToIdMap.get(typeName);
                                        return typeId ? [{ typeId: typeId }] : [];
                                    })
                                },
                                evolvesFrom: apiCard.evolvesFrom || null,
                                evolvesTo: apiCard.evolvesTo || [],
                                abilities: { create: apiCard.abilities || [] },
                                attacks: {
                                    create: (apiCard.attacks || []).map((attack) => ({
                                        name: attack.name,
                                        cost: {
                                            create: (attack.cost || []).flatMap((costName) => {
                                                const typeId = typeNameToIdMap.get(costName);
                                                return typeId
                                                    ? [{ type: { connect: { id: typeId } } }]
                                                    : [];
                                            })
                                        },
                                        convertedEnergyCost: attack.convertedEnergyCost,
                                        damage: attack.damage || null,
                                        text: attack.text || null
                                    }))
                                },
                                weaknesses: {
                                    create: (apiCard.weaknesses || []).flatMap((weakness) => {
                                        const typeId = typeNameToIdMap.get(weakness.type);
                                        return typeId
                                            ? [
                                                  {
                                                      type: { connect: { id: typeId } },
                                                      value: weakness.value || null
                                                  }
                                              ]
                                            : [];
                                    })
                                },
                                resistances: {
                                    create: (apiCard.resistances || []).flatMap((resistance) => {
                                        const typeId = typeNameToIdMap.get(resistance.type);
                                        return typeId
                                            ? [
                                                  {
                                                      type: { connect: { id: typeId } },
                                                      value: resistance.value || null
                                                  }
                                              ]
                                            : [];
                                    })
                                },
                                convertedRetreatCost: apiCard.convertedRetreatCost || null,
                                rules: apiCard.rules || [],
                                ancientTraitName: apiCard.ancientTraitName || null,
                                ancientTraitText: apiCard.ancientTraitText || null,
                                setId: dbSet.id,
                                number: apiCard.number,
                                artist: apiCard.artist || null,
                                rarity: apiCard.rarity || null,
                                nationalPokedexNumbers: apiCard.nationalPokedexNumbers || [],
                                standard: apiCard.legalities?.standard || null,
                                expanded: apiCard.legalities?.expanded || null,
                                unlimited: apiCard.legalities?.unlimited || null,
                                imageKey: imageKey
                            } //
                        });
                        console.log(` -> ✅ Successfully inserted card ${apiCard.name}.`);
                    } catch (dbError) {
                        console.error(
                            ` -> ❌ Database insertion failed for card ${apiCard.name}:`,
                            dbError
                        );
                    }
                } else if (
                    !existingCard.imageKey &&
                    apiCard.images?.large &&
                    !imageUploadsDisabled
                ) {
                    // Existing card is missing image
                    console.log(` -> Updating missing image for ${apiCard.name}...`);
                    const key = `cards/${apiCard.id}.png`;
                    const uploadResult = await uploadImageToR2(apiCard.images.large, key);

                    if (uploadResult.key) {
                        await prisma.card.update({
                            where: { id: apiCard.id },
                            data: { imageKey: uploadResult.key }
                        });
                        console.log(` -> ✅ Successfully updated image for ${apiCard.name}.`);
                        consecutiveUploadFailures = 0;
                    }
                    if (uploadResult.isHardFailure) {
                        consecutiveUploadFailures++;
                        console.log(
                            ` -> ⚠️ Upload failed. Consecutive failures: ${consecutiveUploadFailures}`
                        );
                    }
                }
                // Image upload circuit breaker
                if (consecutiveUploadFailures >= FAILURE_THRESHOLD && !imageUploadsDisabled) {
                    imageUploadsDisabled = true;
                    console.error(
                        ` -> ❌ CRITICAL: Disabling future image uploads due to ${FAILURE_THRESHOLD} consecutive failures.`
                    );
                }
                // Wait 200ms before uploading next card
                await delay(200);
            }
        } catch (error) {
            console.error(`API Card response error for set ${dbSet.name}:`, error);
        }
    }
    console.log('Card sync complete');
}

async function main() {
    console.log('Starting database population');

    await seedMasterData();
    const { typeNameToIdMap, subtypeNameToIdMap } = await prepareLookups();
    await syncSets();
    await syncCards(typeNameToIdMap, subtypeNameToIdMap);

    console.log('-- ✅ Database population complete ✅ --');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
