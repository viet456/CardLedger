import { PrismaClient } from '../src/generated/prisma';
import fetch from 'node-fetch';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';
import { z } from 'zod';

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

        // Verify image is actually uploaded
        console.log(`Verifying image existence in R2: ${key}`);
        const imageExists = await doesImageExistInR2(key);
        if (imageExists) {
            return key;
        } else {
            throw new Error(`Verification failed for key ${key}`);
        }
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
        const typesResponse = await fetch('https://api.pokemontcg.io/v2/types', {
            headers: { 'X-Api-Key': process.env.POKEMONTCG_API_KEY! }
        });
        const { data: pokemonTypes } = ApiStringsResponseSchema.parse(await typesResponse.json());
        const subtypesResponse = await fetch('https://api.pokemontcg.io/v2/subtypes', {
            headers: { 'X-Api-Key': process.env.POKEMONTCG_API_KEY! }
        });
        const { data: pokemonSubtypes } = ApiStringsResponseSchema.parse(
            await subtypesResponse.json()
        );
        await prisma.type.createMany({
            data: pokemonTypes.map((name) => ({ name })),
            skipDuplicates: true
        });
        await prisma.subtype.createMany({
            data: pokemonSubtypes.map((name) => ({ name })),
            skipDuplicates: true
        });
    } catch (error) {
        console.error('Failed to seed master data from API:', error);
        process.exit(1);
    }
    console.log('Master data seeded');
}

// Create lookup maps
async function prepareLookups() {
    const allTypes = await prisma.type.findMany();
    const subTypes = await prisma.subtype.findMany();

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

    const setsResponse = await fetch('https://api.pokemontcg.io/v2/sets', {
        headers: { 'X-Api-Key': process.env.POKEMONTCG_API_KEY! }
    });
    try {
        const { data: setsData } = ApiSetResponseSchema.parse(await setsResponse.json());
        for (const apiSet of setsData) {
            // Check if set already exists in db
            const existingSet = setsInDbMap.get(apiSet.id);
            if (!existingSet) {
                console.log(`Creating new set: ${apiSet.name}`);
                const symbolImageKey = await uploadImageToR2(
                    apiSet.images.symbol,
                    `sets/${apiSet.id}-symbol.png`
                );
                const logoImageKey = await uploadImageToR2(
                    apiSet.images.logo,
                    `sets/${apiSet.id}-logo.png`
                );

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
        }
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

    for (const dbSet of setsInDb) {
        console.log(`Checking set: ${dbSet.name}`);

        const imageCount = await prisma.card.count({
            where: {
                setId: dbSet.id,
                imageKey: { not: null }
            }
        });
        // Ensure sets have all their cards and images
        if (dbSet._count.cards < dbSet.total || imageCount < dbSet.total) {
            console.log(
                `- Set  is incomplete. Cards: (${dbSet._count.cards}/${dbSet.total}) Images: Images: (${imageCount}/${dbSet.total}). Fetching cards -`
            );

            const cardsResponse = await fetch(
                `https://api.pokemontcg.io/v2/cards?q=set.id:${dbSet.id}`,
                {
                    headers: { 'X-Api-key': process.env.POKEMONTCG_API_KEY! }
                }
            );
            try {
                const { data: cardsData } = ApiCardResponseSchema.parse(await cardsResponse.json());

                for (const apiCard of cardsData) {
                    const existingCard = await prisma.card.findUnique({
                        where: { id: apiCard.id }
                    });
                    if (existingCard) continue;
                    console.log(`- Processing card: ${apiCard.name}`);

                    // Fill in card data
                    let imageKey: string | null = null;
                    if (apiCard.images?.large) {
                        const key = `cards/${apiCard.id}.png`;

                        // Check if image is in R2 before uploading
                        const imageExists = await doesImageExistInR2(key);
                        if (!imageExists) {
                            imageKey = await uploadImageToR2(apiCard.images.large, key);
                        } else {
                            imageKey = key;
                            console.log(`Image already exists in R2, skipping: ${key}`);
                        }
                    }

                    await prisma.card.create({
                        data: {
                            id: apiCard.id,
                            name: apiCard.name,
                            supertype: apiCard.supertype,
                            subtypes: {
                                // Match api subtypes to our map containing coresponding ids
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
                            abilities: {
                                create: (apiCard.abilities || []).map((ability: ApiAbility) => ({
                                    name: ability.name,
                                    text: ability.text,
                                    type: ability.type
                                }))
                            },
                            attacks: {
                                create: (apiCard.attacks || []).map((attack: ApiAttack) => ({
                                    name: attack.name,
                                    cost: {
                                        create: (attack.cost || []).flatMap((costName: string) => {
                                            const typeId = typeNameToIdMap.get(costName);
                                            return typeId
                                                ? [
                                                      {
                                                          type: {
                                                              connect: {
                                                                  id: typeId
                                                              }
                                                          }
                                                      }
                                                  ]
                                                : [];
                                        })
                                    },
                                    convertedEnergyCost: attack.convertedEnergyCost,
                                    damage: attack.damage,
                                    text: attack.text
                                }))
                            },
                            weaknesses: {
                                create: (apiCard.weaknesses || []).flatMap(
                                    (weakness: ApiWeakness) => {
                                        const typeId = typeNameToIdMap.get(weakness.type);
                                        return typeId
                                            ? [
                                                  {
                                                      type: {
                                                          connect: { id: typeId }
                                                      },
                                                      value: weakness.value || null
                                                  }
                                              ]
                                            : [];
                                    }
                                )
                            },
                            resistances: {
                                create: (apiCard.resistances || []).flatMap(
                                    (resistance: ApiResistance) => {
                                        const typeId = typeNameToIdMap.get(resistance.type);
                                        return typeId
                                            ? [
                                                  {
                                                      type: {
                                                          connect: { id: typeId }
                                                      },
                                                      value: resistance.value || null
                                                  }
                                              ]
                                            : [];
                                    }
                                )
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
                            // Legalities
                            standard: apiCard.legalities?.standard || null,
                            expanded: apiCard.legalities?.expanded || null,
                            unlimited: apiCard.legalities?.unlimited || null,
                            imageKey: imageKey
                        }
                    });
                }
            } catch (error) {
                console.error('API Card response did not match schema: ', error);
            }
        } else {
            console.log('- Set complete, skipping -');
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
