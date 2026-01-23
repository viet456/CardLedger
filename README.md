# CardLedger

[![Live Demo](https://img.shields.io/badge/Live-Demo-blue?style=for-the-badge)](https://cardledger.io/)

CardLedger is a web application for cataloging and tracking Pokémon card collections. It features a custom data pipeline that sources, standardizes, and serves card data from a dedicated database, ensuring high performance and data consistency.

## Key Features

- **Custom Data Backend:** Card data and images are sourced via a custom ETL script, standardized, and served from a Neon PostgreSQL database and Cloudflare R2 bucket.
- **User Accounts & Collections:** Full authentication system (Email + Social Login) allowing users to build and manage their personal card portfolios.
- **Optimistic UI:** Instant feedback for collection actions using TRPC and optimistic cache updates.
- **High Performance:** Hybrid architecture utilizing Next.js 16 Server Components, ISR caching, and client-side IndexedDB for browsing 20,000+ cards with zero latency.
- **Investment Tracking:** Monitor the financial value and history of your cards.

## Tech Stack

### Application

- **Framework:** Next.js 16 (App Router) / React 19.2
- **Language:** TypeScript
- **Auth:** Better Auth (Google, Discord, Email/Pass)
- **State/API:** tRPC, TanStack Query, Zustand
- **Styling:** Tailwind CSS, Shadcn UI
- **Deployment:** Vercel, Cloudflare R2, Neon

### Data Pipeline & Infrastructure

- **Database:** Neon (PostgreSQL)
- **Image Storage:** Cloudflare R2
- **ETL Script:** Node.js, Prisma, Zod

## Project Goals

This project serves as a portfolio piece to demonstrate my full-stack development skills using a modern tech stack. The primary goals are to learn and implement features such as user authentication, database management, and designing a robust data pipeline, while building a practical and useful tool for TCG enthusiasts.

This project was started on September 15, 2025.

To run this project locally:

1.  Clone the repository:
    `git clone https://github.com/viet456/CardLedger`
2.  Install dependencies:
    `pnpm install`
3.  Set up your environment variables in a `.env` file.
4.  Run the development server:
    `pnpm run dev`

Open [http://localhost:3000](http://localhost:3000) to view it in your browser.
