# CardLedger

[![CI](https://img.shields.io/github/actions/workflow/status/viet456/CardLedger/CI.yml?style=for-the-badge)](https://github.com/viet456/CardLedger/actions/workflows/CI.yml)
[![Live Demo](https://img.shields.io/badge/Live-Demo-blue?style=for-the-badge)](https://cardledger.io/)

CardLedger is a production-grade platform for cataloging and tracking Pokémon TCG collections. It differentiates itself through a **local-first** architecture that utilizes client-side indexing, background mutation queues, and real-time syncing to deliver near-instant interactions, completely independent of network latency.

## Core Features

- **📶 Offline-First & Real-Time Sync:** Add or edit collection entries without an internet connection. Changes are queued locally and automatically reconciled across multi-device sessions in real-time via Server-Sent Events (SSE) when connectivity is restored.
- **📊 Portfolio Analytics:** Tracks acquisition date and cost basis vs. current market value. Visualizes portfolio performance over time with aggregate "Cost vs. Value" charts and percentage growth metrics.
- **🔍 Instant Search:** Performs zero-latency filtering across 21,000+ cards using pre-calculated intersection maps and persisted client-side indexes.
- **📱 Infinite Grid:** Features a highly optimized, infinite-scrolling virtualized grid for browsing massive card sets without pagination lag.

## Engineering Highlights

### 📡 Event-Driven Sync & Conflict Resolution
To transition the app from a simple CRUD interface to a highly concurrent real-time system, I engineered a custom background sync engine:
- **IndexedDB Outbox:** Client mutations are intercepted and stored in a local outbox queue, enabling an optimistic UI that never silently fails on flaky connections.
- **Strict Last-Write-Wins (LWW):** To handle multi-device race conditions (eg editing a card on a phone while deleting it on a laptop), the server acts as a timestamp referee, rejecting stale writes and preserving data integrity.
- **Zero-Polling SSE Tower:** Provisioned a dedicated Node.js/Linux VPS running an Nginx reverse proxy to listen directly to Postgres `pg_notify` channels. This broadcasts Server-Sent Events (SSE) to connected clients, triggering targeted delta-syncs without the overhead of HTTP polling.
- **Read-Omission Safety:** Engineered a 5-second overlapping cursor window during delta-syncs to ensure slow, out-of-order database transaction commits are successfully caught by the client.

### ⚡ Progressive Web App (PWA) & Offline Routing
To guarantee the application shell and UI load without a network connection, the platform is configured as an installable PWA with intelligent client-side routing:
- **Service Worker Fallback:** Utilized `@serwist/turbopack` to generate a Service Worker with a `NetworkFirst` strategy. It intercepts failed page navigations and gracefully routes users to a pre-cached `~offline` Next.js boundary.
- **Dynamic Offline Router:** The fallback boundary parses the URL path and dynamically mounts the correct local-first view (Dashboard, Card Details, or Sets Grid), hydrating the UI entirely from the local IndexedDB stores.
- **JIT Asset Caching:** To preserve user bandwidth and local storage, card images are strictly cached at runtime upon first view, while the core JSON catalog is deterministically pre-fetched.

### 💾 Bandwidth-Efficient Data Pipeline
To bypass the latency of traditional DB queries for the read-only catalog:
- **Dictionary Compression:** Separate daily scripts aggregate card and price data into dictionary-indexed JSON streams. This compresses the raw payload from **10MB down to ~3.5MB**, saving ~20MB of JS heap memory on mobile devices.
- **Smart Versioning Protocol:** The client fetches a tiny JSON pointer file to compare the remote version against the local IndexedDB version, verifying integrity via checksum before initiating a data download.
- **Client-Side Merging:** Decoupled data streams (Metadata vs. Market Data) are fetched in parallel and merged via a custom hook, populating a unified **Zustand** store for instant UI access.

### 📈 Binary Price History Persistence
If 4.3M price rows were stored as JSON, every app load would require `JSON.parse()` to allocate millions of individual Number objects on the JS heap. This creates two compounding problems: the parse itself blocks the main thread for seconds, and once those objects go out of scope the garbage collector must scan and free them all at once, causing visible UI freezes. To eliminate both bottlenecks entirely, the platform encodes price history as raw binary and persists it to IndexedDB as an `ArrayBuffer` — meaning the browser can access every value without ever materializing a JS object for it.
- **Delta-Encoded Int32 Binary:** A daily CI script (`generateHistoryIndex.ts`) converts prices to integer cents and stores each card/variant's timeline as day-over-day deltas in a flat `Int32Array`. Day 0 stores the absolute price; every subsequent day stores only the difference from the previous day. Because prices typically fluctuate only slightly between days, most deltas are small integers clustered near zero — which makes the binary blob compress exceptionally well with Brotli.
- **Fixed 4-Byte Layout:** Each value is exactly 4 bytes (Int32), giving the engine a predictable, contiguous memory layout. This avoids the variable-width encoding overhead of JSON strings and allows the browser to map the buffer directly into typed array memory without per-element parsing.
- **Pointer-Based Index:** A lightweight JSON index maps each `(cardId, variant)` pair to its byte offset in the binary buffer, enabling O(1) random access into the correct slice without scanning.
- **Brotli Compression & R2 Hosting:** Both the binary blob and index JSON are Brotli-compressed and uploaded to Cloudflare R2. A versioned pointer file (with SHA-256 checksums) enables the client to skip re-downloads when the local IndexedDB version matches.
- **Zero-Copy Client Reads:** The `HistoryStore` (Zustand + `idb-keyval`) persists the raw `ArrayBuffer` to IndexedDB and re-creates an `Int32Array` view on rehydration. Price lookups decode via a cumulative sum over the delta slice — the browser reads raw bytes directly into the typed array view, bypassing JSON parsing entirely and keeping the JS heap clean.

### 🔄 Automated Market Data Pipeline
The platform maintains a continuously updating local database of card market values and historical trends.
- **Daily Market Sync:** Built an ETL process running on GitHub Actions that queries the TCGdex API to seamlessly fetch and upsert current market data into a relational history table.
- **Scale:** Tracks daily price fluctuations across tens of thousands of cards, managing millions of price history records through optimized batching strategies.
- **Relational Optimization:** Database schema utilizes efficient nested relations (eg shared `Types` tables referenced by `Attacks`) to minimize storage footprint and simplify join logic.

### 🖼️ Cost-Optimized Asset Pipeline
- **Infrastructure Migration:** Replaced expensive managed image optimization services with a custom **Node.js/Sharp** solution hosted on Cloudflare R2, zeroing monthly image serving costs for 80,000+ assets.
- **Frontend Contract Enforcement:** A custom image loader dynamically serves the exact AVIF resolution variant matching the client's viewport width to prevent over-fetching.

### 🚀 On-Demand ISR (Incremental Static Regeneration)
- **Smart Cache Invalidation:** Individual Card Details pages utilize Next.js ISR. A secure webhook allows the daily data script to surgically invalidate/revalidate specific pages only when their underlying data changes.

## Tech Stack

### Application
- **Framework:** Next.js 16 (App Router) / React
- **Language:** TypeScript
- **State & Data Fetching:** Zustand, tRPC, IndexedDB
- **PWA & Caching:** Serwist, Turbopack, Service Workers
- **Auth:** Better Auth (Google, Discord, Email/Pass)
- **Styling:** Tailwind CSS, Shadcn UI

### Infrastructure & Automation
- **Database:** PostgreSQL, Prisma ORM
- **Containerization:** Docker Compose (Postgres, Sync Server, Nginx, Automated Backups)
- **Sync Server:** Linux VPS, Nginx, PM2, Server-Sent Events (SSE)
- **CI/CD:** GitHub Actions (Linting, Daily ETL Cron Jobs)
- **Asset Storage:** Cloudflare R2
- **Deployment:** See [DEPLOY.md](DEPLOY.md) for VPS setup, backup/restore, and disaster recovery

## Project Goals

The objective was to engineer a high-performance application that delivers **instant user feedback** through local-first caching and optimistic UI mutations. Key architectural goals included:

- **Secure Authentication:** Implementing a robust user account system with social providers.
- **Reliable Data Synchronization:** Designing idempotent pipelines to continuously ingest, sanitize, and validate massive datasets from upstream APIs.
- **Zero-Latency Interaction:** Achieving native-app responsiveness through optimistic UI updates and client-side persistence.

This project was started on September 15, 2025.

## Running Locally

1. Clone the repository: `git clone https://github.com/viet456/CardLedger`
2. Install dependencies: `pnpm install`
3. Set up your environment variables in a `.env` file.
4. Populate your DB: `pnpm run db:populate` (Use `pnpm run db:populate:force` to force an update of all cards without skipping existing ones)
5. Run the development server: `pnpm run dev`

Open [http://localhost:3000](http://localhost:3000) to view it in your browser.