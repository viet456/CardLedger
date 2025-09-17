import { PrismaClient } from '@prisma/client/extension';
import fetch from 'node-fetch';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';

const prisma = new PrismaClient();
const BUCKET_NAME = 'cardledger';

interface ApiSet {
    id: string;
    name: string;
    series: string;
    printedTotal: number;
    total: number;
    ptcgoCode?: string;
    releaseDate: Date;
    updatedAt: Date;
    cards: ApiCard[];
    images: {
        symbol: string;
        logo: string;
    };
}

interface ApiCard {
    id: string;
    name: string;
    supertype: 'Pokémon' | 'Trainer' | 'Energy';
    subtypes?: string[];
    hp?: string;
    types?: string[];
    evolvesFrom?: string;
    evolvesTo?: string[];

    abilities: ApiAbility[];
    attacks?: ApiAttack[];
    weaknesses?: ApiWeakness[];
    resistances?: ApiResistance[];
    convertedRetreatCost?: number;

    rules: string[];
    ancientTraitName?: string;
    ancientTraitText?: string;
    number: string;
    artist?: string;
    rarity?: string;
    nationalPokedexNumbers: number[];

    legalities: ApiLegalityStatus;
}

interface ApiAbility {
    name: string;
    text: string;
    type: string;
}

interface ApiAttack {
    name: string;
    cost: string[];
    convertedEnergyCost: number;
    damage: string;
    text: string;
}

interface ApiWeakness {
    type: string;
    value?: string;
}

interface ApiResistance {
    type: string;
    value?: string;
}

interface ApiLegalityStatus {
    standard: string;
    expanded: string;
    unlimited: string;
}

async function uploadImageToR2(imageUrl: string, key: string): Promise<string> {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
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
        console.log(`Successfully uploaded image to R2: ${key}`);
        return key;
    } catch (error) {
        console.error(`Error uploading image for key ${key}:`, error);
        return '';
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
        const { data: pokemonTypes } = (await typesResponse.json()) as { data: string[] };
        const subtypesResponse = await fetch('https://api.pokemontcg.io/v2/subtypes', {
            headers: { 'X-Api-Key': process.env.POKEMONTCG_API_KEY! }
        });
        const { data: pokemonSubtypes } = (await subtypesResponse.json()) as { data: string[] };
        await prisma.type.createMany({
            data: pokemonTypes.map((name) => ({ name })),
            skipDuplicates: true
        });
        await prisma.subtype.createMany({
            data: pokemonSubtypes.map((name) => ({ name })),
            skipDuplicates: true
        });
    } catch (error) {
        console.error('Failed to seed master data from API');
        process.exit(1);
    }
    console.log('Master data seeded');
}

async function main() {
    console.log('Starting database population');
    await seedMasterData();
    const allTypes = await prisma.type.findMany();
    const subTypes = await prisma.subtype.findMany();
    // Create a map where the key is the type/subtype's name and the value is its ID
    const typeNameToIdMap = new Map<string, number>();
    for (const type of allTypes) {
        typeNameToIdMap.set(type.name, type.id);
    }
    const subtypeNameToIdMap = new Map<string, number>();
    for (const subtype of subTypes) {
        subtypeNameToIdMap.set(subtype.name, subtype.id);
    }

    // Ensure sets exist in our database
    console.log('-- Syncing sets -- ');

    const setsInDbMap = new Map();
    const setsInDb = await prisma.set.findMany({
        select: {
            id: true,
            _count: {
                select: { cards: true }
            }
        }
    });
    for (const set of setsInDb) {
        setsInDbMap.set(set.id, set);
    }

    const setsResponse = await fetch('https://api.pokemontcg.io/v2/sets', {
        headers: { 'X-Api-Key': process.env.POKEMONTCG_API_KEY! }
    });
    const setsData = ((await setsResponse.json()) as { data: ApiSet[] }).data;

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
    console.log('Set sync complete');

    console.log('-- Syncing cards --');

    for (const dbSet of setsInDb) {
        console.log(`Checking set: ${dbSet.name}`);
        if (dbSet._count.cards < dbSet.total) {
            console.log(
                `- Set  is incomplete (${dbSet._count.cards}/${dbSet.total}). Fetching cards -`
            );

            const cardsResponse = await fetch(
                `https://api.pokemontcg.io/v2/cards?q=set.id:${dbSet.id}`,
                { headers: { 'X-Api-key': process.env.POKEMONTCG_API_KEY! } }
            );
            const cardsData = ((await cardsResponse.json()) as { data: ApiCard[] }).data;
            if (!cardsData) continue;

            for (const apiCard of cardsData) {
                const existingCard = await prisma.card.findUnique({ where: { id: apiCard.id } });
                if (existingCard) continue;

                console.log(`- Processing card: ${apiCard.name}`);
                // Fill in card data
                await prisma.card.create({
                    data: {
                        id: apiCard.id,
                        name: apiCard.name,
                        supertype: apiCard.supertype,
                        subtypes: {
                            // Match api subtypes to our map containing coresponding ids
                            connect: (apiCard.subtypes || []).flatMap((subtypeName: string) => {
                                const id = subtypeNameToIdMap.get(subtypeName);
                                return id ? [{ id }] : [];
                            })
                        },
                        hp: apiCard.hp ? parseInt(apiCard.hp, 10) : null,
                        types: {
                            connect: (apiCard.types || []).flatMap((typeName: string) => {
                                const id = typeNameToIdMap.get(typeName);
                                return id ? [{ id }] : [];
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
                            create: (apiCard.weaknesses || []).flatMap((weakness: ApiWeakness) => {
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
                            })
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
                        number: apiCard.number,
                        artist: apiCard.artist || null,
                        rarity: apiCard.rarity || null,
                        nationalPokedexNumbers: apiCard.nationalPokedexNumbers || [],
                        // Legalities
                        standard: apiCard.legalities?.standard || null,
                        expanded: apiCard.legalities?.expanded || null,
                        unlimited: apiCard.legalities?.unlimited || null
                    }
                });
            }
        } else {
            console.log('- Set complete, skipping -');
        }
    }
    console.log('-- Database population complete --');
}
