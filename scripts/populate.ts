import { PrismaClient, Supertype, LegalityStatus } from '@prisma/client';
import TCGdex from '@tcgdex/sdk';
import { PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';
import fetch from 'node-fetch';

const prisma = new PrismaClient();
const tcgdex = new TCGdex('en');
const BUCKET_NAME = process.env.R2_BUCKET_NAME!;

// Block Digital-Only & Virtual Sets
const BLOCKED_SERIES = ['tcgp', 'pocket'];

// --- Helper Functions ---

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

function mapLegality(legal: boolean | undefined): LegalityStatus | null {
    if (legal === true) return 'Legal';
    if (legal === false) return 'Banned';
    return null;
}

function normalizeSubtype(subtype: string): string {
    if (subtype === 'Stage1') return 'Stage 1';
    if (subtype === 'Stage2') return 'Stage 2';
    return subtype;
}

async function doesImageExistInR2(key: string): Promise<boolean> {
    try {
        await r2.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
        return true;
    } catch (error: any) {
        if (error.name === 'NotFound') return false;
        return false;
    }
}

async function uploadImageToR2(url: string, key: string): Promise<boolean> {
    try {
        const exists = await doesImageExistInR2(key);
        if (exists) return false;

        const res = await fetch(url);
        if (!res.ok) return false;

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const contentType = res.headers.get('content-type') || 'image/png';

        await r2.send(
            new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                Body: buffer,
                ContentType: contentType
            })
        );
        return true;
    } catch (e) {
        return false;
    }
}

function chunkArray<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

// --- Logic Processors ---

async function processCard(cardRef: any, dbSet: any, cardsWithImages: Set<string>) {
    try {
        const card = await tcgdex.fetch('cards', cardRef.id);
        if (!card) return;

        let supertype: Supertype = 'Pokémon';
        if (card.category === 'Energy') supertype = 'Energy';
        if (card.category === 'Trainer') supertype = 'Trainer';

        const rawSubtypes = [
            card.stage,
            card.suffix,
            card.trainerType,
            (card as any).energyType
        ].filter(Boolean) as string[];
        const uniqueSubtypes = [...new Set(rawSubtypes)].map(normalizeSubtype);
        const descriptionText = card.description || (card as any).effect || null;

        let imageKey: string | null = null;
        let imageUploaded = false;

        if (card.image) {
            const sanitizedId = sanitizePublicId(card.id);
            imageKey = `cards/${sanitizedId}.png`;
            if (!cardsWithImages.has(card.id)) {
                const srcUrl = card.image.endsWith('.png') ? card.image : `${card.image}/high.png`;
                imageUploaded = await uploadImageToR2(srcUrl, imageKey);
            }
        }

        let artistId: number | null = null;
        if (card.illustrator) {
            const artist = await prisma.artist.upsert({
                where: { name: card.illustrator },
                create: { name: card.illustrator },
                update: {}
            });
            artistId = artist.id;
        }

        let rarityId: number | null = null;
        if (card.rarity) {
            const rarity = await prisma.rarity.upsert({
                where: { name: card.rarity },
                create: { name: card.rarity },
                update: {}
            });
            rarityId = rarity.id;
        }

        // --- Sleep Shields for Attacks & Abilities ---
        const attacksCreate = (card.attacks || []).map((atk) => {
            let name = atk.name || 'Unnamed Attack';
            if (!atk.name) console.warn(`    ⚠️  Unnamed Attack on ${card.id}`);
            return {
                name,
                text: atk.effect || null,
                damage: atk.damage ? String(atk.damage) : null,
                convertedEnergyCost: (atk.cost || []).length,
                cost: {
                    create: (atk.cost || []).map((c) => ({
                        type: { connectOrCreate: { where: { name: c }, create: { name: c } } }
                    }))
                }
            };
        });

        const abilitiesCreate = (card.abilities || []).map((ab) => {
            let name = ab.name || 'Unnamed Ability';
            if (!ab.name) console.warn(`    ⚠️  Unnamed Ability on ${card.id}`);
            return { name, text: ab.effect || '', type: ab.type || 'Ability' };
        });

        const variants = card.variants || {};
        
        await prisma.card.upsert({
            where: { id: card.id },
            create: {
                id: card.id,
                setId: dbSet.id,
                name: card.name,
                supertype,
                number: card.localId,
                hp: card.hp ? parseInt(String(card.hp)) : null,
                convertedRetreatCost: card.retreat || null,
                description: descriptionText,
                nationalPokedexNumbers: card.dexId || [],
                pokedexNumberSort: card.dexId?.[0] || null,
                releaseDate: dbSet.releaseDate,
                imageKey,
                imagesOptimized: false,
                subtypes: {
                    create: uniqueSubtypes.map((st) => ({
                        subtype: { connectOrCreate: { where: { name: st }, create: { name: st } } }
                    }))
                },
                types: {
                    create: (card.types || []).map((t) => ({
                        type: { connectOrCreate: { where: { name: t }, create: { name: t } } }
                    }))
                },
                attacks: { create: attacksCreate },
                abilities: { create: abilitiesCreate },
                artistId,
                rarityId,
                hasNormal: variants.normal ?? false,
                hasHolo: variants.holo ?? false,
                hasReverse: variants.reverse ?? false,
                hasFirstEdition: variants.firstEdition ?? false,
            },
            update: {
                hp: card.hp ? parseInt(String(card.hp)) : null,
                hasNormal: variants.normal ?? false,
                hasHolo: variants.holo ?? false,
                hasReverse: variants.reverse ?? false,
                hasFirstEdition: variants.firstEdition ?? false,
                ...(imageKey ? { imageKey } : {}),
                ...(imageUploaded ? { imagesOptimized: false } : {})
            }
        });
        process.stdout.write('.');
    } catch (e) {
        console.error(`\n❌ Error on ${cardRef.id}:`, e);
    }
}

async function syncSeriesAndSets() {
    console.log('🔄 Syncing Series and Sets...');
    const seriesList = await tcgdex.fetch('series');
    if (!seriesList) return;

    for (const s of seriesList) {
        if (BLOCKED_SERIES.includes(s.id)) continue;

        await prisma.series.upsert({
            where: { id: s.id },
            create: { id: s.id, name: s.name, logo: s.logo },
            update: { name: s.name }
        });

        const details = await tcgdex.fetch('series', s.id);
        if (!details) continue;

        for (const set of details.sets) {
            // 🛠️ Spelling Fix
            const correctedName = set.name.replace("Macdonald's", "McDonald's");

            // --- Image Sync Logic ---
            let logoImageKey: string | null = null;
            let symbolImageKey: string | null = null;
            let imagesUpdated = false; // Flag to trigger re-optimization if needed

            if (set.logo) {
                const key = `sets/${set.id}-logo.png`;
                // Try to upload. If returns true, it means we uploaded a NEW file.
                const uploaded = await uploadImageToR2(set.logo + '.png', key);
                logoImageKey = key;
                if (uploaded) imagesUpdated = true;
            }

            if (set.symbol) {
                const key = `sets/${set.id}-symbol.png`;
                const uploaded = await uploadImageToR2(set.symbol + '.png', key);
                symbolImageKey = key;
                if (uploaded) imagesUpdated = true;
            }
            // ------------------------

            await prisma.set.upsert({
                where: { id: set.id },
                create: {
                    id: set.id,
                    tcgdexId: set.id,
                    name: correctedName,
                    series: s.name,
                    seriesId: s.id,
                    printedTotal: set.cardCount.official,
                    total: set.cardCount.total,
                    releaseDate: (set as any).releaseDate
                        ? new Date((set as any).releaseDate)
                        : new Date(),
                    updatedAt: new Date(),
                    logoImageKey,
                    symbolImageKey,
                    logoOptimized: false,
                    symbolOptimized: false
                },
                update: {
                    total: set.cardCount.total,
                    name: correctedName,
                    ...(logoImageKey ? { logoImageKey } : {}),
                    ...(symbolImageKey ? { symbolImageKey } : {}),
                    ...(imagesUpdated ? { logoOptimized: false, symbolOptimized: false } : {})
                }
            });
        }
    }
}

async function syncCards() {
    console.log('🃏 Syncing Cards (Smart Skip Mode)...');
    const dbSets = await prisma.set.findMany({ where: { seriesId: { notIn: BLOCKED_SERIES } } });

    for (const dbSet of dbSets) {
        const existing = await prisma.card.findMany({
            where: { setId: dbSet.id, imageKey: { not: null } },
            select: { id: true }
        });
        const completed = new Set(existing.map((c) => c.id));
        const setDetails = await tcgdex.fetch('sets', dbSet.tcgdexId!);
        if (!setDetails || !setDetails.cards) {
            console.log(`  ⚠️  ${dbSet.name} has no cards data on TCGdex. Skipping.`);
            continue;
        }

      const toProcess = setDetails.cards.filter((c) => !completed.has(c.id));
        // const toProcess = setDetails.cards;
        if (toProcess.length === 0) {
            console.log(`  ✅ ${dbSet.name} is 100% complete. Moving on...`);
            continue;
        }

        console.log(`\n🚀 ${dbSet.name}: Processing ${toProcess.length} missing cards...`);
        const chunks = chunkArray(toProcess, 20);
        for (const chunk of chunks) {
            await Promise.all(chunk.map((c) => processCard(c, dbSet, completed)));
        }
    }
}

async function main() {
    await syncSeriesAndSets();
    await syncCards();
    console.log('\n✨ Database Population Complete.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());