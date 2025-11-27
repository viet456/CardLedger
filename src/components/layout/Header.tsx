'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MobileNav } from './MobileNav';
import { HeaderSearchBar } from '../search/HeaderSearchBar';
import { ThemeToggle } from './ThemeToggle';
import { Button } from '../ui/button';
import { useSession, signOut } from '@/src/lib/auth-client';
import { UserNav } from './UserNav';

export const navItems = [
    { href: '/', label: 'Home' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/cards?sortBy=rD&sortOrder=desc', label: 'Cards' },
    { href: '/sets', label: 'Sets' },
    { href: '/about', label: 'About' }
];

interface HeaderProps {
    initialUser?: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
    } | null;
}

export function Header({ initialUser }: HeaderProps) {
    const { data: session, isPending } = useSession();
    const user = isPending ? initialUser : session?.user;
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

                    {/* Logged out */}
                    {!user && (
                        <div className='flex'>
                            <Button asChild>
                                <Link href='/sign-in'>Sign In</Link>
                            </Button>
                        </div>
                    )}
                    {/* Logged in */}
                    {user && <UserNav user={user} />}
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
