import { Metadata } from 'next';
import { Globe, AtSign, Github } from 'lucide-react';

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
                    CardLedger began with a strict engineering constraint: handle massive, 
                    relationship-heavy datasets (21,000+ cards and 3.4M+ price records) over the web, 
                    but make the experience feel as instant and fluid as a locally installed desktop app. 
                    Born from the frustration of slow, pagination-heavy web interfaces, it serves as both a 
                    functional TCG collection manager and a technical case study in building a high-performance, 
                    type-safe, and scalable architecture from the ground up.
                </p>
                <p>
                    For a deeper dive into the architectural decisions,{' '}
                    <a
                        href='https://www.vietle.me/blog/cardledger-architecture'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='hover:text-foreground hover:text-foreground/70'
                    >
                        read the full technical breakdown.
                    </a>
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
                        distinct entities. Sequential processing with
                        retry logic and circuit breakers ensures resilience against API rate limits, 
                        while Prisma&apos;s idempotent upserts allow the
                        script to run daily via GitHub Actions without manual intervention.
                    </li>
                    <li>
                        <b>Prisma & Advanced Filtering</b>: The normalized data is managed by{' '}
                        <b>Prisma ORM</b>. By leveraging Prisma&apos;s powerful relation filtering, 
                        the backend can execute complex, multi-parameter queries that would be impossible 
                        with the source APIs alone, managing over 3.4 million price history records.
                    </li>
                </ul>

                <h2>The Frontend Architecture: A Local-First Approach</h2>
                <p>
                    Delivering 21,000+ cards without sacrificing performance required a highly optimized data strategy:
                </p>
                <ul>
                    <li>
                        <b>Dictionary Compression & Sync</b>: To bypass traditional DB query latency, data is aggregated into dictionary-indexed JSON streams, compressing the raw payload from <b>8MB down to ~350KB</b>. A smart versioning protocol ensures clients only download new data when necessary.
                    </li>
                    <li>
                        <b>Local-First Search</b>: To achieve a &ldquo;native app&rdquo; feel, the application uses a client-side
                        indexing strategy. Data is cached locally with <b>IndexedDB</b> and queried via <b>Zustand</b> and <b>uFuzzy</b>. 
                        By utilizing a highly optimized micro-library alongside custom pre-calculated intersection maps, 
                        the app achieves 0.3ms filtering latency, eliminating network wait times and making browsing 21,000+ 
                        cards feel instantaneous.
                    </li>
                    <li>
                        <b>Optimistic UI Patterns</b>: Collection interactions—adding or removing
                        cards—update instantly in the UI while <b>tRPC</b> handles 
                        database synchronization in the background. Automatic state rollback ensures data consistency during network failures.
                    </li>
                    <li>
                        <b>On-Demand Invalidation</b>: To bridge the gap between Static Site Generation (SSG)
                        and real-time data, the backend triggers targeted cache purges via a secure
                        webhook whenever the ETL pipeline updates prices. This ensures users
                        always see fresh data without nuking the entire CDN cache.
                    </li>
                </ul>

                <h2>Security & Asset Optimization</h2>
                <ul>
                    <li>
                        <b>Robust Authentication</b>: Security is handled via Better Auth (Google, Discord, Email). The implementation focuses
                        on <b>Server-Side Authentication</b> to eliminate layout shifts and ensure a
                        premium, flicker-free user experience.
                    </li>
                    <li>
                        <b>Cost-Optimized Asset Pipeline</b>: A custom <b>Node.js/Sharp</b> script processes card images into 
                        highly optimized AVIF formats stored in Cloudflare R2. This pipeline eliminates runtime image transformation costs and proactively generates variants for all target breakpoints to prevent hydration errors.
                    </li>
                </ul>

                <h2 className='mt-8 border-t pt-6'>About the Creator</h2>
                <p>
                    My name is Viet Le, and I&apos;m a full-stack developer with a passion for
                    building high-quality, performant web applications. CardLedger is my capstone
                    portfolio project, built from the ground up to demonstrate mastery of modern
                    application architecture, from database design to frontend optimization.
                </p>
                {/* Creator Section */}
                <div className='flex flex-col gap-2'>
                    <a
                        href='https://vietle.me'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='flex items-center gap-2 text-sm hover:text-foreground/70 hover:underline'
                    >
                        <Globe className='h-4 w-4' /> Portfolio
                    </a>
                    <a
                        href='https://github.com/viet456'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='flex items-center gap-2 text-sm hover:text-foreground/70 hover:underline'
                    >
                        <Github className='h-4 w-4' />
                        Github
                    </a>
                    <a
                        href='https://x.com/vietle683'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='flex items-center gap-2 text-sm hover:text-foreground/70 hover:underline'
                    >
                        <AtSign className='h-4 w-4' />
                        vietle683
                    </a>
                </div>
            </article>
        </main>
    );
}