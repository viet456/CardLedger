import type { Metadata } from 'next';
import type { Viewport } from 'next';
import './globals.css';
import { Header } from '../components/ui/Header';
import { Footer } from '../components/ui/Footer';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/src/components/ui/theme-provider';
import { TrpcProvider } from '../providers/TRPCProvider';
import { ScrollToTopButton } from '../components/ScrollToTopButton';
import { CardDataInitializer } from '../components/CardDataInitializer';
import Script from 'next/script';

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

export default function RootLayout({
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
                <TrpcProvider>
                    <ThemeProvider
                        attribute='class'
                        defaultTheme='system'
                        enableSystem
                        disableTransitionOnChange
                    >
                        <CardDataInitializer />
                        <Header />
                        <main className='flex-grow'>{children}</main>
                        <Footer />
                        <ScrollToTopButton />
                    </ThemeProvider>
                </TrpcProvider>
            </body>
        </html>
    );
}
