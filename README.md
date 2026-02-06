# CardLedger

[![CI](https://github.com/viet456/CardLedger/actions/workflows/CI.yml/badge.svg)](https://github.com/viet456/CardLedger/actions/workflows/CI.yml)
[![Live Demo](https://img.shields.io/badge/Live-Demo-blue?style=for-the-badge)](https://cardledger.io/)

CardLedger is a production-grade platform for cataloging and tracking Pokémon TCG collections. It differentiates itself through a **local-first** architecture that utilizes client-side indexing and heavy caching (IndexedDB) to deliver near-instant interactions, independent of network latency.

## Core Features

- **📊 Portfolio Analytics:** Tracks acquisition date and cost basis vs. current market value. Visualizes portfolio performance over time with aggregate "Cost vs. Value" charts and percentage growth metrics.
- **⚡ Optimistic Mutation Protocol:** Implements immediate UI updates for collection actions (e.g., card counts increment instantly). Uses **tRPC** to handle background synchronization and automatically rolls back state if the database transaction fails.
- **🔍 Instant Search:** Performs zero-latency filtering across 20,000+ cards using pre-calculated intersection maps and persisted client-side indexes.
- **📱 Infinite Grid:** Features a highly optimized, infinite-scrolling virtualized grid for browsing massive card sets without pagination lag.

## Engineering Highlights

### 💾 Bandwidth-Efficient Sync Architecture

To bypass the latency of traditional DB queries, I engineered a "Local-First" data strategy:

- **Dictionary Compression:** Separate daily scripts aggregate card and price data into dictionary-indexed JSON streams. This reduces the raw payload from **8MB to ~3.5MB**, compressing down to **~350KB** over the wire (Brotli).
- **Smart Versioning Protocol:** Implemented a "Pointer File" mechanism. The client first fetches a tiny JSON pointer to compare the remote version against the local IndexedDB version. It initiates a data download _only_ if the versions mismatch, verifying integrity via checksum before committing to local storage.
- **Client-Side Merging:** Decoupled data streams (Metadata vs. Market Data) are fetched in parallel and merged via a custom hook, populating a unified **Zustand** store for instant UI access.

### 🔄 Cross-API Data Synthesis & Integrity

The platform synthesizes data from disparate sources (TCGDex API + PokemonPriceTracker API) that lack shared foreign keys.

- **Fuzzy Matching Pipeline:** Built an ETL process running on GitHub Actions that normalizes and links pricing data to card records via name/number heuristics, upserting daily market data into a history table.
- **Scale:** Successfully backfilled and currently manages **2.2 million+ price history records** using efficient batching strategies.
- **Relational Optimization:** Database schema utilizes efficient nested relations (e.g., shared `Types` tables referenced by `Attacks`) to minimize storage footprint and simplify join logic.

### 🖼️ Cost-Optimized Asset Pipeline

- **Infrastructure Migration:** Replaced expensive managed image optimization services with a custom **Node.js/Sharp** solution hosted on R2, significantly reducing monthly infrastructure overhead while maintaining high performance.
- **Self-Healing State:** The asset pipeline tracks an `isOptimized` state for every card in the database, making the synchronization script fully idempotent (re-runnable without side effects).
- **Frontend Contract Enforcement:** To prevent hydration errors, the pipeline proactively generates image variants for all four target breakpoints. This satisfies the strict requirements of the frontend `loader.ts`, preventing 404s even when upstream source images are smaller than the target display container.

### 🚀 On-Demand ISR (Incremental Static Regeneration)

- **Smart Cache Invalidation:** Individual Card Details pages (`/card/[id]`) utilize Next.js ISR. I implemented a secure webhook (protected by environment keys) that allows the daily data script to surgically invalidate/revalidate specific pages only when their underlying data changes, ensuring users always see fresh data without nuking the entire CDN cache.

## Tech Stack

### Application

- **Framework:** Next.js 16 (App Router) / React 19.2
- **Language:** TypeScript
- **State:** tRPC, TanStack Query, Zustand, IndexedDB (Dexie.js)
- **Auth:** Better Auth (Google, Discord, Email/Pass)
- **Styling:** Tailwind CSS, Shadcn UI
- **Deployment:** Vercel, Cloudflare R2, Neon (Serverless Postgres)

### Infrastructure & Automation

- **Database:** Neon (PostgreSQL)
- **CI/CD:** GitHub Actions (Linting, Type Safety, Daily ETL Cron Jobs)
- **Asset Storage:** Cloudflare R2

## Project Goals

The objective was to engineer a high-performance application that delivers **instant user feedback** through local-first caching and optimistic UI mutations. Key architectural goals included:

- **Secure Authentication:** Implementing a robust user account system with social providers.
- **Reliable Data Synchronization:** Designing idempotent pipelines to sanitize and merge inconsistent data from multiple third-party APIs.
- **Zero-Latency Interaction:** Achieving native-app responsiveness through optimistic UI updates and client-side persistence.

This project was started on September 15, 2025.

## Running Locally

1.  Clone the repository:
    `git clone https://github.com/viet456/CardLedger`
2.  Install dependencies:
    `pnpm install`
3.  Set up your environment variables in a `.env` file.
4.  Run the development server:
    `pnpm run dev`

Open [http://localhost:3000](http://localhost:3000) to view it in your browser.
