import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'About | CardLedger',
    description: 'Learn about the architecture and technology behind the CardLedger project.'
};

export default function About() {
    return (
        <main className='mx-auto my-10 px-4'>
            <article className='prose dark:prose-invert'>
                <h1>About CardLedger: A Deep Dive into Full-Stack Development</h1>
                <p>
                    CardLedger was born from a desire to master the entire modern web development
                    stack, from database design to frontend performance. It serves as both a
                    functional TCG collection manager and a case study in building a
                    high-performance, type-safe, and scalable web application from the ground up.
                </p>

                <h2>The Backend & Data Foundation</h2>
                <p>
                    The project's foundation began with a significant data challenge: how to
                    efficiently manage and query the vast Pokémon TCG dataset. Instead of simply
                    relying on the public `pokemontcg.io` API for every user request, I engineered a
                    robust backend to ensure speed and control:
                </p>
                <ul>
                    <li>
                        <b>Custom Database</b>: An ETL-like script ingests the entire dataset from
                        the API into a <b>PostgreSQL</b> database (hosted on Neon), creating a
                        reliable single source of truth. The ingestion script is designed to be{' '}
                        <b>idempotent</b> (meaning it can be run multiple times without creating
                        duplicate entries), making it suitable for automation via a cron job to keep
                        the database in sync with the source API over time.
                    </li>
                    <li>
                        <b>Relational Schema with Prisma</b>: Using <b>Prisma</b>, I designed a
                        relational schema with tables for cards, sets, types, and artists. This
                        structure enables complex, client/server-side filtering and searching that
                        would be impossible with the source API alone.
                    </li>
                    <li>
                        <b>Data Normalization</b>: The ingestion script normalizes the data,
                        creating efficient lookup tables. This reduces data duplication and forms
                        the backbone of the application's filtering capabilities.
                    </li>
                </ul>

                <h2>The Frontend Architecture: A Hybrid Approach for Peak Performance</h2>
                <p>
                    Delivering nearly 20,000 cards without sacrificing performance required a hybrid
                    rendering strategy:
                </p>
                <ul>
                    <li>
                        <b>Static Site Generation (SSG)</b>: For pages with a defined dataset, like
                        an individual set's card list, I leveraged <b>Next.js's SSG</b>. These pages
                        are pre-built on the server at build time, resulting in instant load times
                        and optimal SEO. The user receives a static HTML file with all the card data
                        and images ready to go.
                    </li>
                    <li>
                        <b>Optimized Client-Side Power</b>: For browsing the entire card collection,
                        a custom build script generates a pruned, <b>normalized JSON artifact</b>{' '}
                        containing all cards and their associated metadata. This artifact is
                        downloaded once to the user's <b>IndexedDB</b> and managed in memory with{' '}
                        <b>Zustand</b>. A versioning system checks against a pointer file on{' '}
                        <b>Cloudflare R2</b> to ensure data freshness, preventing unnecessary
                        downloads. This provides an incredibly fast, "app-like" viewing and
                        filtering experience locally.
                    </li>
                    <li>
                        This standalone script can be integrated into a <b>CI/CD pipeline</b>,
                        allowing for automatic updates to the client-side data whenever the database
                        is changed.
                    </li>
                </ul>

                <h2>Key Features & Technical Highlights</h2>
                <ul>
                    <li>
                        <b>End-to-End Type Safety</b>: <b>TypeScript</b> is used throughout,
                        enforced by <b>Prisma</b> on the backend, <b>Zod</b> for validation, and
                        shared types for the frontend, eliminating an entire class of potential
                        bugs.
                    </li>
                    <li>
                        <b>Decoupled Component Architecture</b>: Core UI elements, like the
                        search/filter interface and the virtualized card grid were built as reusable
                        components. They are <b>independent of their data source</b>, allowing them
                        to be powered by server-side props (SSG) or the client-side store with no
                        changes to the component itself.
                    </li>
                    <li>
                        <b>Real-time Search</b>: The header search bar uses <b>tRPC</b> to provide a
                        server-side search experience with tiered priority for card id’s, names, and
                        suggestions.
                    </li>
                    <li>
                        <b>Image Optimization</b>: Card images are stored in <b>Cloudflare R2</b>{' '}
                        and served via <b>Cloudinary</b> for on-the-fly optimization, automatically
                        converting them to modern formats like AVIF/WebP and compressing them for
                        fast delivery.
                    </li>
                </ul>

                <p>
                    This project represents my dedication to building high-quality, performant, and
                    maintainable web applications by making thoughtful architectural decisions.
                </p>

                <h2 className='mt-8 border-t pt-6'>About the Creator</h2>
                <p>
                    My name is Viet Le, and I'm a full-stack developer with a passion for building
                    high-quality, performant web applications. CardLedger is my capstone portfolio
                    project, built from the ground up to master modern application architecture,
                    from database design and data flow to frontend performance optimization.
                </p>
                <p>
                    You can learn more about my journey and see my other work on my personal site,
                    or connect with me on X.
                    <br />
                    <a href='https://vietle.me' target='_blank' rel='noopener noreferrer'>
                        vietle.me
                    </a>
                    <br />
                    <a href='https://x.com/vietle683' target='_blank' rel='noopener noreferrer'>
                        @vietle683
                    </a>
                </p>
            </article>
        </main>
    );
}
