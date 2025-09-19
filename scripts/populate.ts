import { PrismaClient } from '../src/generated/prisma';
import fetch from 'node-fetch';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';
import { set, z } from 'zod';

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
    damage: z.string(),
    text: z.string()
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

function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processInBatches<T, R>(
    items: T[],
    batchSize: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    let results: R[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batchItems = items.slice(i, i + batchSize);
        console.log(`Processing batch ${i / batchSize + 1} / ${Math.ceil(items.length / batchSize)}...`);
        const batchPromises = batchItems.map(fn);
        const batchResults = await Promise.all(batchPromises);
        if (i + batchSize < items.length) { // Don't delay after the last batch
            await delay(1000); 
        }
        results = results.concat(batchResults);
    }
    return results;
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

async function uploadImageToR2(imageUrl: string, key: string): Promise<string | null> {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
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
        await r2.send(command);
        console.log(`Successfully sent upload command for image: ${key}`);
        return key;
    } catch (error) {
        console.error(`Error in uploading/verifing image for key ${key}:`, error);
        return null;
    }
}

async function seedMasterData() {
    console.log('Seeding master data...');

    // Seeds the types and subtypes tables
    try {
        // Get types and subtypes lists from API
        const [typesResponse, subtypesResponse] = await Promise.all([
            fetch('https://api.pokemontcg.io/v2/types', {
                headers: { 'X-Api-Key': process.env.POKEMONTCG_API_KEY! }
            }), 
            fetch('https://api.pokemontcg.io/v2/subtypes', {
                headers: { 'X-Api-Key': process.env.POKEMONTCG_API_KEY! }
            }),
        ]);
        
        const { data: pokemonTypes } = ApiStringsResponseSchema.parse(await typesResponse.json());
        const { data: pokemonSubtypes } = ApiStringsResponseSchema.parse(
            await subtypesResponse.json()
        );

        // Write types tables in DB
        await Promise.all([
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
        console.error('Failed to seed master data from API:', error);
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
    const [setsInDb, setsResponse] = await Promise.all([
        prisma.set.findMany({
            select: {
                id: true,
                total: true,
                _count: {
                    select: { cards: true }
                }
            }
        }),
        fetch('https://api.pokemontcg.io/v2/sets', {
            headers: { 'X-Api-Key': process.env.POKEMONTCG_API_KEY! }
        })
    ]);
    const setsInDbMap = new Map();
    for (const set of setsInDb) {
        setsInDbMap.set(set.id, set);
    }

    try {
        const { data: setsData } = ApiSetResponseSchema.parse(await setsResponse.json());

        const setPromises = setsData.map(async (apiSet) => {
            // Check if set already exists in db
            const existingSet = setsInDbMap.get(apiSet.id);
            if (!existingSet) {
                console.log(`Creating new set: ${apiSet.name}`);

                // Upload set images
                const [symbolImageKey, logoImageKey] = await Promise.all([
                    uploadImageToR2(
                        apiSet.images.symbol,
                        `sets/${apiSet.id}-symbol.png`
                    ),
                    uploadImageToR2(
                        apiSet.images.logo,
                        `sets/${apiSet.id}-logo.png`
                    )
                ])
                
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
                        symbolImageKey: symbolImageKey,
                        logoImageKey: logoImageKey
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
        console.error('API Set response did not match schema: ', error);
        process.exit(1);
    }
    console.log('Set sync complete');
}

async function syncCards(
    typeNameToIdMap: Map<string, number>,
    subtypeNameToIdMap: Map<string, number>
) {
    console.log('-- Syncing cards --');

    // Fetch all sets from database at once, including card counts
    const setsInDb = await prisma.set.findMany({
        select: {
            id: true,
            total: true,
            name: true,
            _count: {
                select: {
                    cards: true
                }
            }
        }
    });

    // Identify incomplete sets by checking card and image counts simultaneously
    const setCompletenessChecks = await Promise.all(
        setsInDb.map(async (dbSet) => {
            console.log(`Checking set: ${dbSet.name}`);

            const [cardCount, imageCount] = await Promise.all([
                prisma.card.count({
                    where: {
                        setId: dbSet.id
                    }
                }),
                prisma.card.count({
                    where: {
                        setId: dbSet.id,
                        imageKey: { not: null }
                    }
                })
            ])
            
            const isComplete = cardCount >= dbSet.total && imageCount >= dbSet.total;
            if (!isComplete) {
                console.log(
                    `- Set ${dbSet.name} is incomplete. Cards: (${cardCount}/${dbSet.total}) Images: Images: (${imageCount}/${dbSet.total}). Fetching cards -`
                );
            };
            return { ...dbSet, isComplete };
        })
    );

    const incompleteSets = setCompletenessChecks.filter((set) => !set.isComplete);
    if (incompleteSets.length === 0) {
        console.log('All sets are up to date. Card sync complete.');
        return;
    }
    console.log(`Found ${incompleteSets.length} incomplete sets. Fetching card data...`);

    // Fetch card data for all incomplete sets simultaneously
    const allFetchedCardData = (
        await processInBatches(incompleteSets, 5, async (dbSet) => {
            try {
                const cardsResponse = await fetch(
                            `https://api.pokemontcg.io/v2/cards?q=set.id:${dbSet.id}`,
                            {
                                headers: { 'X-Api-key': process.env.POKEMONTCG_API_KEY! }
                            }
                        );
                const { data: cardsData } = ApiCardResponseSchema.parse(await cardsResponse.json());
                return { dbSet, cardsData};
            } catch (error) {
                console.error(`API Card response error for set ${dbSet.name}:`, error);
                return null;
            }
        })
    ).filter((result): result is NonNullable<typeof result> => result !== null);

    // Insert cards simultaneously
    // await Promise.all(
    //     allFetchedCardData.map(async ({ dbSet, cardsData }) => {
    //         const existingCardIds = new Set(
    //             (await prisma.card.findMany({ where: { setId: dbSet.id}, select: { id: true} } )).map(
    //                 (c) => c.id
    //             )
    //         );

    //         const cardsToCreate = cardsData.filter((card) => !existingCardIds.has(card.id));

    //         if (cardsToCreate.length === 0) {
    //             console.log(`- All cards for set ${dbSet.name} already exist. Skipping insertions. -`);
    //             return;
    //         }

    //         const newCardPromises = cardsToCreate.map(async (apiCard) => {
    //             let imageKey: string | null = null;
    //             if (apiCard.images?.large) {
    //                 const key = `cards/${apiCard.id}.png`;
    //                 const imageExists = await doesImageExistInR2(key);
    //                 if (!imageExists) {
    //                     imageKey = await uploadImageToR2(apiCard.images.large, key);
    //                 } else {
    //                     // Image is in R2 but is not yet linked to card
    //                     imageKey = key;
    //                 }

    //             }
    //             return {
    //                 id: apiCard.id,
    //                 name: apiCard.name,
    //                 supertype: apiCard.supertype,
    //                 subtypes: {
    //                     // Match api subtypes to our map containing coresponding ids
    //                     create: (apiCard.subtypes || []).flatMap(
    //                         (subtypeName: string) => {
    //                             const subtypeId = subtypeNameToIdMap.get(subtypeName);
    //                             return subtypeId ? [{ subtypeId: subtypeId }] : [];
    //                         }
    //                     )
    //                 },
    //                 hp: apiCard.hp ? parseInt(apiCard.hp, 10) : null,
    //                 types: {
    //                     create: (apiCard.types || []).flatMap((typeName: string) => {
    //                         const typeId = typeNameToIdMap.get(typeName);
    //                         return typeId ? [{ typeId: typeId }] : [];
    //                     })
    //                 },
    //                 evolvesFrom: apiCard.evolvesFrom || null,
    //                 evolvesTo: apiCard.evolvesTo || [],
    //                 abilities: {
    //                     create: (apiCard.abilities || []).map(
    //                         (ability: ApiAbility) => ({
    //                             name: ability.name,
    //                             text: ability.text,
    //                             type: ability.type
    //                         })
    //                     )
    //                 },
    //                 attacks: {
    //                     create: (apiCard.attacks || []).map((attack: ApiAttack) => ({
    //                         name: attack.name,
    //                         cost: {
    //                             create: (attack.cost || []).flatMap(
    //                                 (costName: string) => {
    //                                     const typeId = typeNameToIdMap.get(costName);
    //                                     return typeId
    //                                         ? [
    //                                             {
    //                                                 type: {
    //                                                     connect: {
    //                                                         id: typeId
    //                                                     }
    //                                                 }
    //                                             }
    //                                         ]
    //                                         : [];
    //                                 }
    //                             )
    //                         },
    //                         convertedEnergyCost: attack.convertedEnergyCost,
    //                         damage: attack.damage,
    //                         text: attack.text
    //                     }))
    //                 },
    //                 weaknesses: {
    //                     create: (apiCard.weaknesses || []).flatMap(
    //                         (weakness: ApiWeakness) => {
    //                             const typeId = typeNameToIdMap.get(weakness.type);
    //                             return typeId
    //                                 ? [
    //                                     {
    //                                         type: {
    //                                             connect: { id: typeId }
    //                                         },
    //                                         value: weakness.value || null
    //                                     }
    //                                 ]
    //                                 : [];
    //                         }
    //                     )
    //                 },
    //                 resistances: {
    //                     create: (apiCard.resistances || []).flatMap(
    //                         (resistance: ApiResistance) => {
    //                             const typeId = typeNameToIdMap.get(resistance.type);
    //                             return typeId
    //                                 ? [
    //                                     {
    //                                         type: {
    //                                             connect: { id: typeId }
    //                                         },
    //                                         value: resistance.value || null
    //                                     }
    //                                 ]
    //                                 : [];
    //                         }
    //                     )
    //                 },
    //                 convertedRetreatCost: apiCard.convertedRetreatCost || null,
    //                 rules: apiCard.rules || [],
    //                 ancientTraitName: apiCard.ancientTraitName || null,
    //                 ancientTraitText: apiCard.ancientTraitText || null,
    //                 setId: dbSet.id,
    //                 number: apiCard.number,
    //                 artist: apiCard.artist || null,
    //                 rarity: apiCard.rarity || null,
    //                 nationalPokedexNumbers: apiCard.nationalPokedexNumbers || [],
    //                 // Legalities
    //                 standard: apiCard.legalities?.standard || null,
    //                 expanded: apiCard.legalities?.expanded || null,
    //                 unlimited: apiCard.legalities?.unlimited || null,
    //                 imageKey: imageKey
    //             };
    //         })
    //         const newCardsData = (await Promise.all(newCardPromises)).filter(
    //             (card): card is NonNullable<typeof card> => card !== null
    //         );
    //         if (newCardsData.length > 0) {
    //             console.log(`- Inserting ${newCardsData.length} new cards for set ${dbSet.name} -`);
    //             await Promise.all(
    //                 newCardsData.map((cardData) => {
    //                     return prisma.card.create({ data: cardData as any});
    //                 })
    //             );
    //         };
    //     }) 
    // );

    for (const { dbSet, cardsData } of allFetchedCardData) {
        const existingCardIds = new Set(
            (await prisma.card.findMany({ where: { setId: dbSet.id }, select: { id: true } })).map(
                (c) => c.id
            )
        );

        const cardsToCreate = cardsData.filter((card) => !existingCardIds.has(card.id));
        if (cardsToCreate.length === 0) {
            console.log(`- All cards for set ${dbSet.name} already exist. Skipping insertions. -`);
            continue; 
        }

        console.log(`Processing ${cardsToCreate.length} new cards for set ${dbSet.name}...`);
        
        const newCardsDataPromises = (apiCard: ApiCard) => {
            return (async () => {
                let imageKey: string | null = null;
                if (apiCard.images?.large) {
                    const key = `cards/${apiCard.id}.png`;
                    const imageExists = await doesImageExistInR2(key);
                    if (!imageExists) {
                        imageKey = await uploadImageToR2(apiCard.images.large, key);
                    } else {
                        imageKey = key;
                    }
                }
                return {
                    id: apiCard.id,
                    name: apiCard.name,
                    supertype: apiCard.supertype,
                    subtypes: {
                        create: (apiCard.subtypes || []).flatMap((subtypeName: string) => {
                            const subtypeId = subtypeNameToIdMap.get(subtypeName);
                            return subtypeId ? [{ subtypeId: subtypeId }] : [];
                        })
                    },
                    hp: apiCard.hp ? parseInt(apiCard.hp, 10) : null,
                    types: {
                        create: (apiCard.types || []).flatMap((typeName: string) => {
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
                                    return typeId ? [{ type: { connect: { id: typeId } } }] : [];
                                })
                            },
                            convertedEnergyCost: attack.convertedEnergyCost,
                            damage: attack.damage,
                            text: attack.text
                        }))
                    },
                    weaknesses: {
                        create: (apiCard.weaknesses || []).flatMap((weakness) => {
                            const typeId = typeNameToIdMap.get(weakness.type);
                            return typeId ? [{ type: { connect: { id: typeId } }, value: weakness.value || null }] : [];
                        })
                    },
                    resistances: {
                        create: (apiCard.resistances || []).flatMap((resistance) => {
                            const typeId = typeNameToIdMap.get(resistance.type);
                            return typeId ? [{ type: { connect: { id: typeId } }, value: resistance.value || null }] : [];
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
                };
            })();
        };
        
        const newCardsData = (await processInBatches(cardsToCreate, 25, newCardsDataPromises))
            .filter((card): card is NonNullable<typeof card> => card !== null);

        if (newCardsData.length > 0) {
            console.log(`- Inserting ${newCardsData.length} new cards for set ${dbSet.name} -`);
            await Promise.all(
                newCardsData.map((cardData) => {
                    return prisma.card.create({ data: cardData as any });
                })
            );
        }
    }
}


async function main() {
    console.log('Starting database population');

    await seedMasterData();
    const { typeNameToIdMap, subtypeNameToIdMap } = await prepareLookups();
    await syncSets();
    await syncCards(typeNameToIdMap, subtypeNameToIdMap);

    console.log('-- Database population complete --');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
