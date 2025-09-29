import { publicProcedure, router } from '../trpc';
import { PrismaClient } from '@prisma/client';

// http://localhost:3000/api/trpc/pokemonMetadata.getFilterOptions
const prisma = new PrismaClient();
// defines the dynamic parameter values that can be searched by for pokemon cards
// based on our db tables and their columns
export const pokemonMetadataRouter = router({
    getFilterOptions: publicProcedure.query(async () => {
        const [types, subtypes, rarities, artists] = await Promise.all([
            prisma.type.findMany({ orderBy: { name: 'asc' } }),
            prisma.subtype.findMany({ orderBy: { name: 'asc' } }),
            prisma.rarity.findMany({ orderBy: { name: 'asc' } }),
            prisma.artist.findMany({ orderBy: { name: 'asc' } })
        ]);
        return {
            types, // also for weakness and resistance types selectors
            subtypes,
            rarities,
            artists
        };
    })
});
