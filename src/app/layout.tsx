import type { Metadata } from 'next';
import type { Viewport } from 'next';
import './globals.css';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Inter } from 'next/font/google';

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
        <html lang='en' className={`dark ${inter.variable}`}>
            <body
                className={`flex min-h-screen flex-col bg-background font-sans text-foreground antialiased`}
            >
                <Header />
                <main className='flex-grow'>{children}</main>
                <Footer />
            </body>
        </html>
    );
}
