import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Footer } from '../components/layout/Footer';
import { Inter } from 'next/font/google';
import { ScrollToTopButton } from '../components/ScrollToTopButton';
import { CardDataInitializer } from '../components/CardDataInitializer';
import { ProvidersWrapper } from '../providers/ProvidersWrapper';
import { Header } from '../components/layout/Header';
import { LazyAnalytics } from '../components/LazyAnalytics';
import { SerwistProvider } from './serwist';

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
    metadataBase: new URL('https://www.cardledger.io'),
    applicationName: APP_NAME,
    title: {
        default: APP_DEFAULT_TITLE,
        template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent', 
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
    themeColor: '#000000',
};

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang='en' className={`${inter.variable}`} suppressHydrationWarning>
            <head>
                <link rel='preconnect' href='https://assets.cardledger.io' />
            </head>
            <body
                className={`flex min-h-screen flex-col bg-background font-sans text-foreground antialiased`}
            >
                <SerwistProvider swUrl="/serwist/sw.js">
                    <ProvidersWrapper session={null}>
                        <CardDataInitializer />
                        <Header />
                        <main className='flex-grow'>{children}</main>
                        <Footer />
                        <ScrollToTopButton />
                    </ProvidersWrapper>
                </SerwistProvider>
                <LazyAnalytics />
            </body>
        </html>
    );
}