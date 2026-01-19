'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MobileNav } from './MobileNav';
import { HeaderSearchBar } from '../search/HeaderSearchBar';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '../ui/button';
import { UserNav } from './UserNav';
import { useAuthSession } from '@/src/providers/SessionProvider';

export const navItems = [
    { href: '/', label: 'Home' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/cards?sortBy=rD&sortOrder=desc', label: 'Cards' },
    { href: '/sets', label: 'Sets' },
    { href: '/about', label: 'About' }
];

export function Header() {
    const { data: session } = useAuthSession();
    const user = session?.user;
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const pathname = usePathname();

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
                onClick={() => isMobile && setIsMenuOpen(false)}
                className={`text-base font-medium transition-colors hover:text-primary ${
                    isActive ? 'text-foreground' : 'text-muted-foreground'
                }`}
            >
                {label}
            </Link>
        );
    };

    return (
        <header className='sticky top-0 z-50 w-full border-b border-border bg-card'>
            <div className='container flex h-14 max-w-screen-2xl items-center justify-between px-4 md:px-8'>
                {/* Logo + Desktop nav grouped */}
                <div className='flex items-center gap-8'>
                    <Link
                        href='/'
                        className='mr-4 flex items-center gap-2 space-x-2 text-xl font-bold md:mr-2'
                    >
                        CardLedger
                    </Link>

                    {/* Desktop navigation */}
                    <nav className='hidden items-center gap-6 text-sm font-medium md:flex'>
                        {navItems.map((item) => (
                            <NavLink key={item.href} href={item.href} label={item.label} />
                        ))}
                    </nav>
                </div>

                {/* Desktop actions group */}
                <div className='flex items-center gap-4'>
                    <div className='hidden w-full max-w-sm items-center space-x-2 md:flex'>
                        {showHeaderSearch && (
                            <HeaderSearchBar onSuggestionClick={() => setIsMenuOpen(false)} />
                        )}
                    </div>

                    <div className='hidden items-center gap-2 md:flex'>
                        {/* Logged out */}
                        {!user && (
                            <Button asChild variant='ghost' size='sm' className='text-sm'>
                                <Link href='/sign-in'>Sign In</Link>
                            </Button>
                        )}
                        {/* Logged in */}
                        {user && <UserNav user={user} />}
                        <ThemeToggle />
                    </div>

                    {/* Mobile navigation toggle */}
                    <div className='md:hidden'>
                        <MobileNav />
                    </div>
                </div>
            </div>
        </header>
    );
}
