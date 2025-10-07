'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MobileNav } from './MobileNav';
import { HeaderSearchBar } from '../search/HeaderSearchBar';

export const navItems = [
    { href: '/', label: 'Home' },
    { href: '/cards', label: 'Cards' },
    { href: '/sets', label: 'Sets' }
];

export function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const pathname = usePathname();
    // don't show headersearchbar on Cards page
    const showHeaderSearch = pathname !== '/cards';

    const NavLink = ({
        href,
        label,
        isMobile = false
    }: {
        href: string;
        label: string;
        isMobile?: boolean;
    }) => {
        const isActive = pathname === href;
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
                <div className='hidden max-w-sm flex-grow justify-end md:block'>
                    {showHeaderSearch && (
                        <HeaderSearchBar onSuggestionClick={() => setIsMenuOpen(false)} />
                    )}
                </div>
                {/* Mobile navigation*/}
                <div className='md:hidden'>
                    <MobileNav />
                </div>
            </div>
        </header>
    );
}
