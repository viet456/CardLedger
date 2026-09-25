import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Supertype, LegalityStatus } from '../prisma/generated/client';
import TCGdex from '@tcgdex/sdk';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { r2 } from '../src/lib/r2';
import { uploadImageToR2 } from './lib/r2Upload';

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const tcgdex = new TCGdex('en');
const BUCKET_NAME = process.env.R2_BUCKET_NAME!;

// Block Digital-Only & Virtual Sets
const BLOCKED_SERIES = ['tcgp', 'pocket'];

// Block incomplete/bad sets with broken dates
const BLOCKED_SETS = ['mee', 'mfb', '2024sv', '2023sv', '2022swsh', 'jumbo'];

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

// uploadImageToR2 extracted to scripts/lib/r2Upload.ts (shared with the set-merge tooling).

function chunkArray<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
    const retries = 5;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (e: any) {
            const msg = e?.message || '';
            const isRetryable =
                msg.includes('invalid error') ||
                msg.includes('500') ||
                msg.includes('502') ||
                msg.includes('503');
            if (isRetryable && attempt < retries) {
                const delay = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s, 16s, 32s
                console.warn(
                    `\n  ⏳ Retry ${attempt + 1}/${retries} for ${label} in ${delay}ms...`
                );
                await sleep(delay);
                continue;
            }
            throw e;
        }
    }
    throw new Error(`withRetry: exhausted retries for ${label}`);
}

// --- Logic Processors ---

async function processCard(cardRef: any, dbSet: any, cardsWithImages: Set<string>) {
    try {
        const card = await withRetry(() => tcgdex.fetch('cards', cardRef.id), `cards/${cardRef.id}`);
        if (!card) return;

        // Existing row lookup — backs the image-compensation guard below: a
        // compensated / non-convention imageKey must never be overwritten
        // (the API is not the source of truth for which R2 object serves art).
        const selfExists = await prisma.card.findUnique({
            where: { id: card.id },
            select: { id: true, imageKey: true }
        });

        let supertype: Supertype = 'Pokémon';
        if (card.category === 'Energy') supertype = 'Energy';
        if (card.category === 'Trainer') supertype = 'Trainer';

        const rawSubtypes = [
            card.stage,
            card.suffix,
            card.trainerType,
            card.energyType
        ].filter(Boolean) as string[];
        const uniqueSubtypes = [...new Set(rawSubtypes)].map(normalizeSubtype);
        const uniqueTypes = [...new Set(card.types || [])];
        const descriptionText = card.description || card.effect || null;

        let imageKey: string | null = null;
        let imageUploaded = false;

        if (card.image) {
            const sanitizedId = sanitizePublicId(card.id);
            const expectedImageKey = `cards/${sanitizedId}.png`;
            const existingKey = selfExists?.imageKey ?? null;
            if (existingKey && existingKey !== expectedImageKey) {
                // Compensated / non-convention key (the dedupe pipeline copies a
                // shadow card's image onto its keeper) — the API is NOT the
                // source of truth for which R2 object serves a card's art.
                // Never overwrite it or the next populate (even --force) would
                // orphan the image.
                imageKey = existingKey;
            } else if (!cardsWithImages.has(card.id)) {
                const srcUrl = card.image.endsWith('.png') ? card.image : `${card.image}/high.png`;
                try {
                    imageUploaded = await uploadImageToR2(srcUrl, expectedImageKey);
                    imageKey = expectedImageKey; // Only assign to the DB variable if upload succeeded
                } catch (uploadError) {
                    console.warn(`    ⚠️ Upload failed for ${card.id}. Saving card data with null imageKey.`);
                    imageKey = null; // Explicitly ensure it stays null for the DB
                }
            } else {
                // We already have the image in R2 from a previous run
                imageKey = expectedImageKey;
            }
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
                        type: { connect: { name: c } }
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

        // Collect ALL unique type names from every source on this card
        // so we can upsert them once before the card write.
        const allTypeNames = new Set<string>();
        for (const t of uniqueTypes) allTypeNames.add(t);
        for (const w of (card.weaknesses || [])) allTypeNames.add(w.type);
        for (const r of (card.resistances || [])) allTypeNames.add(r.type);
        for (const atk of (card.attacks || [])) {
            for (const c of (atk.cost || [])) allTypeNames.add(c);
        }

        // Pre-create all shared reference records with idempotent upserts.
        // These are safe under concurrent Promise.all — two upserts for the
        // same name both succeed (one inserts, the other hits ON CONFLICT and
        // is a no-op update). This avoids P2002 races that `connectOrCreate`
        // inside concurrent nested writes causes with @prisma/adapter-pg.
        const refUpserts: Promise<any>[] = [];
        if (card.illustrator) {
            refUpserts.push(prisma.artist.upsert({ where: { name: card.illustrator }, create: { name: card.illustrator }, update: {} }));
        }
        if (card.rarity) {
            refUpserts.push(prisma.rarity.upsert({ where: { name: card.rarity }, create: { name: card.rarity }, update: {} }));
        }
        for (const st of uniqueSubtypes) {
            refUpserts.push(prisma.subtype.upsert({ where: { name: st }, create: { name: st }, update: {} }));
        }
        for (const t of allTypeNames) {
            refUpserts.push(prisma.type.upsert({ where: { name: t }, create: { name: t }, update: {} }));
        }
        await Promise.all(refUpserts);

        // Extract TCGplayer product ID from pricing data
        const pricing = (card as any).pricing;
        let tcgPlayerId: number | null = null;
        if (pricing?.tcgplayer) {
            // Scan all variant keys (holofoil, normal, reverse-holofoil, etc.)
            for (const variant of Object.values(pricing.tcgplayer)) {
                if (variant && typeof variant === 'object' && 'productId' in variant) {
                    tcgPlayerId = (variant as any).productId as number;
                    break;
                }
            }
        }
        // Fallback: look in variants_detailed[].thirdParty.tcgplayer
        if (!tcgPlayerId && (card as any).variants_detailed) {
            for (const vd of (card as any).variants_detailed) {
                if (vd?.thirdParty?.tcgplayer) {
                    tcgPlayerId = vd.thirdParty.tcgplayer as number;
                    break;
                }
            }
        }

        await prisma.card.upsert({
            where: { id: card.id },
            create: {
                id: card.id,
                set: { connect: { id: dbSet.id } },
                name: card.name,
                supertype,
                number: card.localId,
                hp: card.hp ? parseInt(String(card.hp)) : null,
                convertedRetreatCost: card.retreat || null,
                description: descriptionText,
                regulationMark: card.regulationMark ?? null,
                evolvesFrom: card.evolveFrom ?? null,
                evolvesTo: (card as any).evolveTo ?? [],
                rules: (card as any).rules ?? [],
                nationalPokedexNumbers: card.dexId || [],
                pokedexNumberSort: card.dexId?.[0] || null,
                releaseDate: dbSet.releaseDate,
                standard: mapLegality(card.legal?.standard),
                expanded: mapLegality(card.legal?.expanded),
                unlimited: mapLegality((card.legal as Record<string, boolean>)?.unlimited),
                imageKey,
                imagesOptimized: false,
                subtypes: {
                    create: uniqueSubtypes.map((st) => ({
                        subtype: { connect: { name: st } }
                    }))
                },
                types: {
                    create: uniqueTypes.map((t) => ({
                        type: { connect: { name: t } }
                    }))
                },
                weaknesses: {
                    create: (card.weaknesses || []).map((w) => ({
                        type: { connect: { name: w.type } },
                        value: w.value ?? null,
                    })),
                },
                resistances: {
                    create: (card.resistances || []).map((r) => ({
                        type: { connect: { name: r.type } },
                        value: r.value ?? null,
                    })),
                },
                attacks: { create: attacksCreate },
                abilities: { create: abilitiesCreate },
                ...(card.illustrator ? { artist: { connect: { name: card.illustrator } } } : {}),
                ...(card.rarity ? { rarity: { connect: { name: card.rarity } } } : {}),
                hasNormal: variants.normal ?? false,
                hasHolo: variants.holo ?? false,
                hasReverse: variants.reverse ?? false,
                hasFirstEdition: variants.firstEdition ?? false,
                hasWPromo: (variants as any).wPromo ?? false,
                tcgPlayerId
            },
            update: {
                // Sync all API-owned scalars — API is source of truth
                hp: card.hp ? parseInt(String(card.hp)) : null,
                name: card.name,
                supertype,
                number: card.localId,
                description: descriptionText,
                regulationMark: card.regulationMark ?? null,
                nationalPokedexNumbers: card.dexId || [],
                pokedexNumberSort: card.dexId?.[0] || null,
                evolvesFrom: card.evolveFrom ?? null,
                evolvesTo: (card as any).evolveTo ?? [],
                rules: (card as any).rules ?? [],
                convertedRetreatCost: card.retreat || null,
                releaseDate: dbSet.releaseDate,
                ...(card.illustrator ? { artist: { connect: { name: card.illustrator } } } : {}),
                ...(card.rarity ? { rarity: { connect: { name: card.rarity } } } : {}),
                standard: mapLegality(card.legal?.standard),
                expanded: mapLegality(card.legal?.expanded),
                unlimited: mapLegality((card.legal as Record<string, boolean>)?.unlimited),
                hasNormal: variants.normal ?? false,
                hasHolo: variants.holo ?? false,
                hasReverse: variants.reverse ?? false,
                hasFirstEdition: variants.firstEdition ?? false,
                hasWPromo: (variants as any).wPromo ?? false,
                tcgPlayerId,
                ...(imageKey ? { imageKey } : {}),
                ...(imageUploaded ? { imagesOptimized: false } : {}),
                // Sync relational data on update to propagate API corrections
                subtypes: {
                    deleteMany: {},
                    create: uniqueSubtypes.map((st) => ({
                        subtype: { connect: { name: st } }
                    })),
                },
                types: {
                    deleteMany: {},
                    create: uniqueTypes.map((t) => ({
                        type: { connect: { name: t } }
                    })),
                },
                weaknesses: {
                    deleteMany: {},
                    create: (card.weaknesses || []).map((w) => ({
                        type: { connect: { name: w.type } },
                        value: w.value ?? null,
                    })),
                },
                resistances: {
                    deleteMany: {},
                    create: (card.resistances || []).map((r) => ({
                        type: { connect: { name: r.type } },
                        value: r.value ?? null,
                    })),
                },
                abilities: {
                    deleteMany: {},
                    create: abilitiesCreate,
                },
                attacks: {
                    deleteMany: {},
                    create: attacksCreate,
                },
            }
        });
        process.stdout.write('.');
    } catch (e) {
        console.error(`\n❌ Error on ${cardRef.id}:`, e);
    }
}

async function syncSeriesAndSets() {
    console.log('🔄 Syncing Series and Sets...');
    const seriesList = await withRetry(() => tcgdex.fetch('series'), 'series');
    if (!seriesList) return;

    // Update from newest to oldest series
    const reversedSeries = [...seriesList].reverse();

    for (const s of reversedSeries) {
        if (BLOCKED_SERIES.includes(s.id)) continue;

        await prisma.series.upsert({
            where: { id: s.id },
            create: { id: s.id, name: s.name, logo: s.logo },
            update: { name: s.name }
        });

        const details = await withRetry(() => tcgdex.fetch('series', s.id), `series/${s.id}`);
        if (!details) continue;

        // Reverse the sets within the series
        const reversedSets = [...details.sets].reverse();

        for (const set of reversedSets) {
            // Ignore blocked sets
            if (BLOCKED_SETS.includes(set.id)) continue;

            console.log(`  Processing set: ${set.name}...`);

            // Fetch full set details to get releaseDate (series endpoint omits it)
            const fullSet = await withRetry(() => tcgdex.fetch('sets', set.id), `sets/${set.id}`);

            // 🛠️ Spelling Fix
            const correctedName = set.name.replace("Macdonald's", "McDonald's");

            // --- Image Sync Logic ---
            let logoImageKey: string | null = null;
            let symbolImageKey: string | null = null;
            let imagesUpdated = false; // Flag to trigger re-optimization if needed

            // Fetch existing set to check if images are already stored
            const existingSet = await prisma.set.findUnique({
                where: { id: set.id },
                select: { logoImageKey: true, symbolImageKey: true }
            });

            if (set.logo) {
                const key = `sets/${set.id}-logo.png`;
                if (existingSet?.logoImageKey !== key) {
                    // Try to upload. If returns true, it means we uploaded a NEW file.
                    try {
                        const uploaded = await uploadImageToR2(set.logo + '.png', key);
                        logoImageKey = key; // Only assign if upload succeeds
                        if (uploaded) imagesUpdated = true;
                    } catch (e) {
                        console.warn(`    ⚠️ Logo upload failed for ${set.id}. Saving set with null logoImageKey.`);
                    }
                } else {
                    logoImageKey = key; // Already exists, just reference it
                }
            }

            if (set.symbol) {
                const key = `sets/${set.id}-symbol.png`;
                if (existingSet?.symbolImageKey !== key) {
                    try {
                        const uploaded = await uploadImageToR2(set.symbol + '.png', key);
                        symbolImageKey = key; // Only assign if upload succeeds
                        if (uploaded) imagesUpdated = true;
                    } catch (e) {
                        console.warn(`    ⚠️ Symbol upload failed for ${set.id}. Saving set with null symbolImageKey.`);
                    }
                } else {
                    symbolImageKey = key; // Already exists, just reference it
                }
            }
            // ------------------------

            const ptcgoCode = fullSet?.tcgOnline || (fullSet as any)?.abbreviation?.official || null;

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
                    ptcgoCode,
                    releaseDate: fullSet?.releaseDate
                        ? new Date(fullSet.releaseDate)
                        : new Date(),
                    updatedAt: new Date(),
                    logoImageKey,
                    symbolImageKey,
                    logoOptimized: false,
                    symbolOptimized: false,
                    standard: mapLegality((fullSet as any)?.legal?.standard),
                    expanded: mapLegality((fullSet as any)?.legal?.expanded),
                },
                update: {
                    tcgdexId: set.id,
                    // Real sitemap lastmod: bump on every metadata sync
                    updatedAt: new Date(),
                    name: correctedName,
                    series: s.name,
                    seriesId: s.id,
                    printedTotal: set.cardCount.official,
                    total: set.cardCount.total,
                    ptcgoCode,
                    standard: mapLegality((fullSet as any)?.legal?.standard),
                    expanded: mapLegality((fullSet as any)?.legal?.expanded),
                    ...(logoImageKey ? { logoImageKey } : {}),
                    ...(symbolImageKey ? { symbolImageKey } : {}),
                    ...(imagesUpdated ? { logoOptimized: false, symbolOptimized: false } : {})
                }
            });
        }
    }
}

const isForce = process.argv.includes('--force');

async function syncCards() {
    console.log(isForce ? '🃏 Syncing Cards (Force Mode — all metadata + re-uploads)...' : '🃏 Syncing Cards (all metadata synced, R2 uploads for missing images)...');
    const dbSets = await prisma.set.findMany({ 
        where: { 
            // Don't sync cards in blocked series and sets
            seriesId: { notIn: BLOCKED_SERIES },
            id: { notIn: BLOCKED_SETS }
        },
        orderBy: { releaseDate: 'desc' }
    });

    for (const dbSet of dbSets) {
        // Track which cards already have images (for R2 upload skip only)
        const existing = await prisma.card.findMany({
            where: { setId: dbSet.id, imageKey: { not: null } },
            select: { id: true }
        });
        const cardsWithImages = new Set(existing.map((c) => c.id));
        const setDetails = await withRetry(() => tcgdex.fetch('sets', dbSet.tcgdexId!), `sets/${dbSet.tcgdexId}`);
        if (!setDetails || !setDetails.cards) {
            console.log(`  ⚠️  ${dbSet.name} has no cards data on TCGdex. Skipping.`);
            continue;
        }

        // In force mode, or normal mode — always process ALL cards for metadata sync.
        // R2 image uploads are skipped per-card inside processCard when image already exists.
        // Smart Skip = skip R2 uploads for cards that already have images.
        // Force Mode = re-upload everything.
        const toProcess = setDetails.cards;
        const missingImages = setDetails.cards.filter((c) => !cardsWithImages.has(c.id));
        
        console.log(`\n🚀 ${dbSet.name}: Syncing ${toProcess.length} cards (R2 uploads: ${isForce ? 'force all' : `${missingImages.length} missing`})...`);
        const chunks = chunkArray(toProcess, 5);
        for (let i = 0; i < chunks.length; i++) {
            await Promise.all(chunks[i].map((c) => processCard(c, dbSet, cardsWithImages)));
            // Throttle to avoid API rate-limiting (5xx errors)
            if (i < chunks.length - 1) await sleep(500);
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
