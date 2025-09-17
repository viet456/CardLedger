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
    types?: string[];
    attacks?: ApiAttack[];
}

interface ApiAttack {
    name: string;
    cost: string[];
    convertedEnergyCost: number;
    damage: string;
    text: string;
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
    const pokemonTypes = [
        'Grass',
        'Fire',
        'Water',
        'Lightning',
        'Psychic',
        'Fighting',
        'Darkness',
        'Metal',
        'Fairy',
        'Dragon',
        'Colorless'
    ];
    const pokemonSubtypes = [
        'Basic',
        'Stage 1',
        'Stage 2',
        'V',
        'VMAX',
        'VSTAR',
        'EX',
        'GX',
        'BREAK',
        'Restored',
        'LEGEND',
        'Level-Up',
        'Mega',
        'Prime',
        'Tera',
        'Radiant'
    ];
    await prisma.type.createMany({
        data: pokemonTypes.map((name) => ({ name })),
        skipDuplicates: true
    });
    await prisma.subtype.createMany({
        data: pokemonSubtypes.map((name) => ({ name })),
        skipDuplicates: true
    });

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
    const setsResponse = await fetch('https://api.pokemontcg.io/v2/sets', {
        headers: { 'X-Api-Key': process.env.POKEMONTCG_API_KEY! }
    });
    const setsData = ((await setsResponse.json()) as { data: ApiSet[] }).data;

    for (const apiSet of setsData) {
        // Check if set already exists
        const existingSet = await prisma.set.findUnique({ where: { id: apiSet.id } });
        if (existingSet) {
            console.log('Set already exists, skipping');
            continue;
        }
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
                ptgcoCode: apiSet.ptcgoCode,
                releaseDate: new Date(apiSet.releaseDate),
                updatedAt: new Date(apiSet.updatedAt),
                symbolImageKey: symbolImageKey,
                logoImageKey: logoImageKey
            }
        });
    }
    console.log('Set sync complete');

    console.log('-- Syncing cards --');
    const setsInDb = await prisma.set.findMany({
        select: {
            id: true,
            _count: {
                select: { cards: true }
            }
        }
    });
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
                        types: {
                            connect: (apiCard.types || []).flatMap((typeName: string) => {
                                const id = typeNameToIdMap.get(typeName);
                                return id ? [{ id }] : [];
                            })
                        },
                        attacks: {
                            create: (apiCard.attacks || []).map((attack: ApiAttack) => ({
                                name: attack.name,
                                // cost
                                cost: {
                                    create: (attack.cost || []).map((costName: string) => {
                                        const typeId = typeNameToIdMap.get(costName);
                                        return typeId
                                            ? [
                                                  {
                                                      type: {
                                                          connect: { id: typeId }
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
                        }
                    }
                });
            }
        } else {
            console.log('- Set complete, skipping -');
        }
    }
    console.log('-- Database population complete --');
}
