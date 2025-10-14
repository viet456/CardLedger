import { PrismaClient } from '@prisma/client';
import { notFound } from 'next/navigation';
import { SetPageView } from './SetPageView';
import { DenormalizedCard, FilterOptions, SetObject } from '@/src/shared-types/card-index';
import { Metadata } from 'next';
import { Suspense } from 'react';

const prisma = new PrismaClient();

function SetPageSkeleton() {
    return (
        <div className='container mx-auto p-4'>
            <div className='h-10 w-1/2 animate-pulse rounded bg-muted'></div>
            <div className='mt-4 h-8 w-full animate-pulse rounded bg-muted'></div>
            <div className='mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'>
                {Array.from({ length: 12 }).map((_, i) => (
                    <div
                        key={i}
                        className='flex aspect-[2.5/3.5] w-full animate-pulse rounded-xl border bg-card'
                    />
                ))}
            </div>
        </div>
    );
}

export async function generateMetadata({
    params
}: {
    params: { setId: string };
}): Promise<Metadata> {
    const set = await prisma.set.findUnique({
        where: { id: params.setId }
    });

    if (!set) {
        return {
            title: 'Set Not Found | CardLedger'
        };
    }

    return {
        title: `${set.name} | CardLedger`,
        description: `Browse all ${set.printedTotal} cards from the ${set.name} set.`
    };
}

export async function generateStaticParams() {
    const sets = await prisma.set.findMany({
        select: {
            id: true
        }
    });
    return sets.map((set) => ({
        setId: set.id
    }));
}

async function getSetData(setId: string) {
    const setWithCardsRaw = await prisma.set.findUnique({
        where: { id: setId },
        include: {
            cards: {
                include: {
                    types: { include: { type: true } },
                    subtypes: { include: { subtype: true } },
                    artist: true,
                    rarity: true,
                    weaknesses: { include: { type: true } },
                    resistances: { include: { type: true } },
                    abilities: true
                }
            }
        }
    });
    if (!setWithCardsRaw) return null;

    setWithCardsRaw.cards.sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true })
    );

    // Helper functions for transformations
    const setInfo: SetObject = {
        ...setWithCardsRaw,
        releaseDate: setWithCardsRaw.releaseDate.toISOString().split('T')[0]
    };
    // Cloudinary stores card images in its /home folder
    const transformImageKey = (imageKey: string | null): string | null => {
        if (!imageKey) return null;
        // Remove the 'cards/' prefix and file extension
        const baseId = imageKey.replace('cards/', '').replace(/\.[^/.]+$/, '');
        // Prepend the correct 'home/' prefix
        return `home/${baseId}`;
    };
    const cards: DenormalizedCard[] = setWithCardsRaw.cards.map((card) => ({
        id: card.id,
        n: card.name,
        hp: card.hp,
        num: card.number,
        img: transformImageKey(card.imageKey),
        pS: card.pokedexNumberSort,
        cRC: card.convertedRetreatCost,
        artist: card.artist?.name || null,
        rarity: card.rarity?.name || null,
        set: setInfo,
        supertype: card.supertype,
        types: card.types.map((t) => t.type.name),
        subtypes: card.subtypes.map((s) => s.subtype.name),
        weaknesses: card.weaknesses.map((w) => w.type.name),
        resistances: card.resistances.map((r) => r.type.name),
        abilities: card.abilities.map((ability) => ({
            name: ability.name,
            text: ability.text,
            type: ability.type
        }))
    }));
    const filterOptions: FilterOptions = {
        rarities: await prisma.rarity.findMany(),
        types: await prisma.type.findMany(),
        subtypes: await prisma.subtype.findMany(),
        artists: await prisma.artist.findMany()
    };
    return { setInfo, cards, filterOptions };
}

export default async function SingleSetPage({ params }: { params: { setId: string } }) {
    const data = await getSetData(params.setId);
    if (!data) notFound();
    return (
        <Suspense fallback={<SetPageSkeleton />}>
            <SetPageView
                setInfo={data.setInfo}
                cards={data.cards}
                filterOptions={data.filterOptions}
            />
        </Suspense>
    );
}
