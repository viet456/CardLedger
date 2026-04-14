import { MetadataRoute } from 'next'
import { prisma } from '@/src/lib/prisma';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = 'https://cardledger.io'

    const cards = await prisma.card.findMany({
        select: { id: true, releaseDate: true }
    })
    const sets = await prisma.set.findMany({
        select: { id: true, updatedAt: true } 
    })

    const cardUrls = cards.map((card) => ({
        url: `${baseUrl}/cards/${card.id}`,
        lastModified: card.releaseDate || new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
    }))
    const setUrls = sets.map((set) => ({
        url: `${baseUrl}/sets/${set.id}`,
        lastModified: set.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.8,
    }))

    return [
        {
        url: baseUrl,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1,
        },
        ...cardUrls,
        ...setUrls,
    ]
}