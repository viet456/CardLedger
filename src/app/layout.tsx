import type { Metadata } from 'next';
import type { Viewport } from 'next';
import './globals.css';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/src/components/layout/theme-provider';
import { TrpcProvider } from '../providers/TRPCProvider';
import { ScrollToTopButton } from '../components/ScrollToTopButton';
import { CardDataInitializer } from '../components/CardDataInitializer';
import { Toaster } from '../components/ui/sonner';
import Script from 'next/script';
import { auth } from '@/src/lib/auth';
import { headers } from 'next/headers';

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
    const session = await auth.api.getSession({
        headers: await headers()
    });
    const initialUser = session?.user
        ? {
              name: session.user.name,
              email: session.user.email,
              image: session.user.image
          }
        : null;
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
                        <Header initialUser={initialUser} />
                        <main className='flex-grow'>{children}</main>
                        <Toaster />
                        <Footer />
                        <ScrollToTopButton />
                    </ThemeProvider>
                </TrpcProvider>
            </body>
        </html>
    );
}
