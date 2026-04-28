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
                    relationship-heavy datasets (21,000+ cards and 4M+ price records) over the
                    web, but make the experience feel as instant and fluid as a locally installed
                    desktop app. Born from the frustration of slow, pagination-heavy web interfaces,
                    it serves as both a functional TCG collection manager and a technical case study
                    in building a high-performance, local-first architecture from the ground up.
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

                <h2>The Backend & Real-Time Infrastructure</h2>
                <ul>
                    <li>
                        <b>The ETL Ingestion Engine</b>: A Node.js pipeline extracts raw API data and
                        normalizes it into a relational schema. Sequential processing with retry logic 
                        and circuit breakers ensures resilience against API rate limits, while Prisma&apos;s
                        idempotent upserts allow daily automation via GitHub Actions.
                    </li>
                    <li>
                        <b>Backend Analytics vs. Local Search</b>: Prisma manages the 4M+ price history records 
                        on the backend to execute complex analytical queries. However, to make catalog browsing 
                        instant, the entire 21,000+ card dataset is indexed client-side. Using uFuzzy and custom 
                        intersection maps, filtering executes in sub-milliseconds without ever hitting the server.
                    </li>
                    <li>
                        <b>Postgres Pub/Sub & SSE Tower</b>: To achieve real-time cross-device sync, 
                        database mutations trigger <code>pg_notify</code> channels. A dedicated Node.js 
                        VPS running behind an Nginx reverse proxy listens to the raw Postgres TCP stream 
                        and broadcasts Server-Sent Events (SSE) to specific clients.
                    </li>
                </ul>

                <h2>A Local-First, Offline-Capable Architecture</h2>
                <p>
                    To achieve a zero-latency &ldquo;native app&rdquo; feel regardless of network conditions, 
                    the application completely decouples the UI from the network layer.
                </p>
                <ul>
                    <li>
                        <b>Offline PWA Routing</b>: A custom Service Worker intercepts network requests. 
                        If the connection is flaky, slow, or completely offline, the app seamlessly falls 
                        back to a locally cached router, keeping the entire catalog searchable in airplane mode.
                    </li>
                    <li>
                        <b>Static CDN Delivery & Dictionary Compression</b>: To bypass traditional database latency, 
                        read-only catalog data is pre-generated as versioned JSON files and hosted on Cloudflare R2. 
                        These files utilize dictionary compression to reduce payloads from 10MB to 3.5MB, halving parse 
                        times and saving ~20MB of JS heap memory.
                    </li>
                    <li>
                        <b>The Outbox Mutation Engine</b>: Collection interactions update instantly via 
                        client-side UUID generation. If the network drops, changes are queued in a local Outbox. 
                        To prevent data loss on captive portals (like coffee shop Wi-Fi), a custom network guard 
                        verifies true internet connectivity before silently syncing the queue in the background.
                    </li>
                    <li>
                        <b>Conflict Resolution & Delta Syncs</b>: The server acts as a Last-Write-Wins (LWW) 
                        referee to gracefully handle stale offline edits. Devices sync efficiently by requesting 
                        only what changed since their last update. To prevent missing data from slow asynchronous 
                        database saves, the sync cursor automatically overlaps by a few seconds to catch delayed transactions.
                    </li>
                </ul>

                <h2>Security & Asset Optimization</h2>
                <ul>
                    <li>
                        <b>Robust Authentication</b>: Security is handled via Better Auth (Google,
                        Discord, Email). The implementation focuses on Server-Side Authentication to 
                        eliminate layout shifts and ensure a stutter-free user experience.
                    </li>
                    <li>
                        <b>Cost-Optimized Asset Pipeline</b>: A custom Node.js/Sharp script
                        processes card images into highly optimized AVIF formats stored in
                        Cloudflare R2, proactively generating variants for all target breakpoints 
                        to prevent runtime processing costs.
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