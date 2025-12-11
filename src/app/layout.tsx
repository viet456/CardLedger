import type { Metadata } from 'next';
import type { Viewport } from 'next';
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

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-sans'
});

export const metadata: Metadata = {
    title: 'CardLedger',
    description: 'The TCG collection manager'
};
export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1
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
                <Suspense fallback={<div className='min-h-screen bg-background' />}>
                    <AppContent>{children}</AppContent>
                </Suspense>
            </body>
        </html>
    );
}
