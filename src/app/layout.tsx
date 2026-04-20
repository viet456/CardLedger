import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Footer } from '../components/layout/Footer';
import { Inter } from 'next/font/google';
import { ScrollToTopButton } from '../components/ScrollToTopButton';
import { CardDataInitializer } from '../components/CardDataInitializer';
import { auth } from '@/src/lib/auth';
import { headers } from 'next/headers';
import { ProvidersWrapper } from '../providers/ProvidersWrapper';
import { Header } from '../components/layout/Header';
import { Suspense } from 'react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import { SerwistProvider } from './serwist'; // <-- Import the new provider

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-sans',
    display: 'swap'
});

// --- PWA & SEO METADATA ---
const APP_NAME = 'CardLedger';
const APP_DEFAULT_TITLE = 'CardLedger | High-Performance TCG Portfolio';
const APP_TITLE_TEMPLATE = '%s | CardLedger';
const APP_DESCRIPTION = 'A local-first, high-performance Pokémon TCG catalog and portfolio manager.';

export const metadata: Metadata = {
    applicationName: APP_NAME,
    title: {
        default: APP_DEFAULT_TITLE,
        template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent', // Optimized for your dark theme
        title: APP_NAME,
    },
    formatDetection: {
        telephone: false,
    },
    openGraph: {
        type: 'website',
        siteName: APP_NAME,
        title: {
            default: APP_DEFAULT_TITLE,
            template: APP_TITLE_TEMPLATE,
        },
        description: APP_DESCRIPTION,
    },
    twitter: {
        card: 'summary',
        title: {
            default: APP_DEFAULT_TITLE,
            template: APP_TITLE_TEMPLATE,
        },
        description: APP_DESCRIPTION,
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#000000', // Matches your manifest.json for a seamless native look
};

async function AppContent({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    return (
        <ProvidersWrapper session={session}>
            <CardDataInitializer />
            <Header />
            <main className='flex-grow'>{children}</main>
            <Footer />
            <ScrollToTopButton />
        </ProvidersWrapper>
    );
}

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang='en' className={`${inter.variable}`} suppressHydrationWarning>
            <body
                className={`flex min-h-screen flex-col bg-background font-sans text-foreground antialiased`}
            >
                {/* Wrap your app in the SerwistProvider pointing to your dynamic route */}
                <SerwistProvider swUrl="/serwist/sw.js">
                    <Suspense fallback={<div className='min-h-screen bg-background' />}>
                        <AppContent>
                            {children}
                        </AppContent>
                    </Suspense>
                </SerwistProvider>
                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    );
}