import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'About | CardLedger',
    description: 'Learn about the architecture and technology behind the CardLedger project.'
};

export default function About() {
    return (
        <main className='my-10 px-4'>
            <article className='prose mx-auto dark:prose-invert'>
                <h1>About CardLedger: Engineering a Modern TCG Platform</h1>
                <p>
                    CardLedger is a technical showcase of modern full-stack architecture. It solves
                    the challenge of managing large, relationship-heavy datasets (20,000+ cards)
                    with the speed and interactivity of a native application. It serves as both a
                    functional TCG collection manager and a case study in building a
                    high-performance, type-safe, and scalable web application from the ground up.
                </p>

                <h2>The Backend & Data Foundation</h2>
                <p>
                    The foundation of CardLedger is a custom-built{' '}
                    <b>Extract, Transform, Load (ETL)</b> pipeline designed to turn raw API data
                    into a high-performance relational asset.
                </p>
                <ul>
                    <li>
                        <b>The Ingestion Engine</b>: A Node.js pipeline extracts raw API data and
                        normalizes it into a relational schema, breaking flat responses into
                        distinct entities (Sets, Artists, Rarities). Sequential processing with
                        retry logic and circuit breakers ensures resilience against API rate limits
                        and transient failures, while Prisma&apos;s idempotent upserts allow the
                        script to run on a schedule via GitHub Actions without manual intervention.
                    </li>
                    <li>
                        <b>Prisma & Advanced Filtering</b>: The normalized data is managed by{' '}
                        <b>Prisma ORM</b>, which serves as the application&apos;s query engine. By
                        leveraging Prisma&apos;s powerful relation filtering, the backend can
                        execute complex, multi-parameter queries that would be impossible with the
                        source API alone.
                    </li>
                    <li>
                        <b>Automation</b>: Fully automated maintenance via <b>GitHub Actions</b>{' '}
                        keeps the database synchronized with new card releases and volatile market
                        prices without manual intervention.
                    </li>
                </ul>

                <h2>The Frontend Architecture: A Hybrid Approach</h2>
                <p>
                    Delivering nearly 20,000 cards without sacrificing performance required a hybrid
                    rendering strategy:
                </p>
                <ul>
                    <li>
                        <b>Local-First Search</b>: The application uses a client-side indexing
                        strategy with a custom versioning protocol to minimize bandwidth while
                        enabling instant, fuzzy-search across the entire 20,000+ card collection.
                        Data is cached locally with IndexedDB and queried via <b>Zustand</b> and{' '}
                        <b>Fuse.js</b>, eliminating network latency during browsing.
                    </li>
                    <li>
                        <b>Optimistic UI Patterns</b>: Collection interactions—adding or removing
                        cards, adjusting quantities—update instantly in the UI while <b>tRPC</b>{' '}
                        handles database synchronization in the background. This creates the tactile
                        responsiveness of native desktop software.
                    </li>
                    <li>
                        <b>Static Site Generation (SSG)</b>: For pages with a defined dataset, like
                        an individual set&apos;s card list, I leveraged Next.js&apos;s SSG. These
                        pages are pre-built on the server at build time, resulting in instant load
                        times and optimal SEO. The user receives a static HTML file with all the
                        card data and images ready to go.
                    </li>
                    <li>
                        <b>On-Demand Invalidation</b>: To bridge the gap between Static Generation
                        and Real-Time Data, the backend triggers targeted cache purges via a secure
                        API route whenever the ETL pipeline updates prices. This ensures users
                        always see fresh price data without sacrificing the performance benefits of
                        SSG.
                    </li>
                </ul>

                <h2>Security & Authentication</h2>
                <p>
                    Transitioning from a read-only viewer to a user-centric application required a
                    robust security layer. I implemented a full authentication system using{' '}
                    <b>Better Auth</b>:
                </p>
                <ul>
                    <li>
                        <b>Robust Authentication</b>: Security is handled via Better Auth with a
                        multi-strategy approach (Google, Discord, Email). The implementation focuses
                        on <b>Server-Side Authentication</b> to eliminate layout shifts and ensure a
                        premium, flicker-free user experience.
                    </li>
                </ul>

                <h2>Key Features & Technical Highlights</h2>
                <ul>
                    <li>
                        <b>End-to-End Type Safety</b>: TypeScript is used throughout, enforced by
                        Prisma on the backend, Zod for validation, and shared types for the
                        frontend, eliminating an entire class of potential bugs.
                    </li>
                    <li>
                        <b>Image Optimization</b>: Card images are processed with <b>Sharp</b> into
                        highly optimized AVIF formats and stored in Cloudflare R2. A custom image
                        loader dynamically serves the optimal resolution based on the user&apos;s
                        viewport, significantly reducing load times.
                    </li>
                    <li>
                        <b>Real-time Search</b>: The header search bar uses tRPC to provide a
                        server-side search experience with tiered priority for card IDs, names, and
                        suggestions.
                    </li>
                </ul>

                <h2 className='mt-8 border-t pt-6'>About the Creator</h2>
                <p>
                    My name is Viet Le, and I&apos;m a full-stack developer with a passion for
                    building high-quality, performant web applications. CardLedger is my capstone
                    portfolio project, built from the ground up to demonstrate mastery of modern
                    application architecture, from database design to frontend optimization.
                </p>
                <p>
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
