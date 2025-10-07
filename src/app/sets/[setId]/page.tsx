import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

export default async function SingleSetPage({ params }: { params: { setId: string } }) {
    const set = await prisma.set.findUnique({
        where: {
            id: params.setId
        }
    });
    if (!set) {
        return <div>Set not found</div>;
    }
    return (
        <div>
            <h1 className='text-4xl font-bold'>{set.name}</h1>
            <p>Series: {set.series}</p>
            <p>Release Date: {set.releaseDate.toLocaleDateString()}</p>
        </div>
    );
}
