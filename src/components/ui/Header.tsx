'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MobileNav } from './MobileNav';
import { HeaderSearchBar } from '../search/HeaderSearchBar';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './button';
import { useSession, signOut } from '@/src/lib/auth-client';

export const navItems = [
    { href: '/', label: 'Home' },
    { href: '/cards?sortBy=rD&sortOrder=desc', label: 'Cards' },
    { href: '/sets', label: 'Sets' },
    { href: '/about', label: 'About' }
];

export function Header() {
    const { data: session, isPending } = useSession();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const pathname = usePathname();
    // don't show headersearchbar on Cards page or setId pages
    const isCardsPage = pathname === '/cards';
    const isSetPage = pathname.startsWith('/sets/');
    const showHeaderSearch = !isCardsPage && !isSetPage;

    const NavLink = ({
        href,
        label,
        isMobile = false
    }: {
        href: string;
        label: string;
        isMobile?: boolean;
    }) => {
        const isActive = pathname === href.split('?')[0];

        return (
            <Link
                href={href}
                className={`${
                    isActive ? 'font-semibold text-accent-foreground' : 'text-muted-foreground'
                } transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground`}
                onClick={() => isMobile && setIsMenuOpen(false)}
            >
                {label}
            </Link>
        );
    };

    return (
        <header className='sticky top-0 z-50 bg-card'>
            <div className='flex h-16 w-full items-center justify-between px-4 text-xl text-primary'>
                {/* Logo + Desktop nav grouped */}
                <div className='flex items-center gap-10 text-xl'>
                    <Link href='/' className='text-3xl'>
                        CardLedger
                    </Link>
                    {/* Desktop navigation */}
                    <nav className='hidden items-center gap-8 md:flex'>
                        {navItems.map((item) => (
                            <NavLink key={item.href} href={item.href} label={item.label} />
                        ))}
                    </nav>
                </div>
                {/* Desktop actions group */}
                <div className='hidden items-center gap-2 md:flex'>
                    <div className='max-w-md flex-grow'>
                        {showHeaderSearch && (
                            <HeaderSearchBar onSuggestionClick={() => setIsMenuOpen(false)} />
                        )}
                    </div>
                    {/* Loading, button skeletons */}
                    {isPending && (
                        <div className='flex gap-2'>
                            <div className='h-9 w-20 animate-pulse rounded-md bg-muted'></div>
                            <div className='h-9 w-20 animate-pulse rounded-md bg-muted'></div>
                        </div>
                    )}
                    {/* Logged out */}
                    {!session?.user && !isPending && (
                        <div className='flex gap-2'>
                            <Button variant='ghost' asChild>
                                <Link href='/sign-in'>Sign In</Link>
                            </Button>

                            <Button asChild>
                                <Link href='/sign-up'>Sign Up</Link>
                            </Button>
                        </div>
                    )}
                    {/* Logged in */}
                    {!isPending && session?.user && (
                        <div className='flex gap-2'>
                            <Button variant='ghost' asChild>
                                <Link href='/dashboard'>Dashboard</Link>
                            </Button>

                            <Button onClick={() => signOut()}>Sign Out</Button>
                        </div>
                    )}
                    <ThemeToggle />
                </div>
                {/* Mobile navigation*/}
                <div className='md:hidden'>
                    <MobileNav />
                </div>
            </div>
        </header>
    );
}
