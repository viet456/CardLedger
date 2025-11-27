import type { Metadata } from 'next';
import type { Viewport } from 'next';
import './globals.css';
import { Footer } from '../components/layout/Footer';
import { Inter } from 'next/font/google';
import { ScrollToTopButton } from '../components/ScrollToTopButton';
import { CardDataInitializer } from '../components/CardDataInitializer';
import Script from 'next/script';
import { Suspense } from 'react';
import { HeaderWrapper } from '../components/layout/HeaderWrapper';
import { ProvidersWrapper } from '../providers/ProvidersWrapper';

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

export default async function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang='en' className={`${inter.variable}`} suppressHydrationWarning>
            <head>
                <Script
                    src='https://challenges.cloudflare.com/turnstile/v0/api.js'
                    strategy='afterInteractive'
                    async
                    defer
                />
                <link rel='preconnect' href='https://challenges.cloudflare.com' />
            </head>
            <body
                className={`flex min-h-screen flex-col bg-background font-sans text-foreground antialiased`}
            >
                <ProvidersWrapper>
                    <CardDataInitializer />
                    <Suspense fallback={<div className='h-16 w-full border-b bg-card' />}>
                        <HeaderWrapper />
                    </Suspense>

                    <main className='flex-grow'>{children}</main>

                    <Footer />
                    <ScrollToTopButton />
                </ProvidersWrapper>
            </body>
        </html>
    );
}
