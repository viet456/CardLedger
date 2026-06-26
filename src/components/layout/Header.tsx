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
import { useIsOffline } from '@/src/providers/OfflineProvider';
import { WifiOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/src/components/ui/tooltip';

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

    const isOffline = useIsOffline();
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
        const basePath = href.split('?')[0];
        const isActive = basePath === '/' 
            ? pathname === '/' 
            : pathname.startsWith(basePath);

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
                        {isOffline && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className='flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-500'>
                                            <WifiOff className='h-3.5 w-3.5' />
                                            <span className='hidden lg:inline'>Offline</span>
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className='text-xs'>You&apos;re offline — browsing cached data</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        {/* Logged in */}
                        {user && <UserNav user={user} />}
                        <ThemeToggle />
                    </div>

                    {/* Mobile navigation toggle */}
                    <div className='flex items-center md:hidden'>
                        {isOffline && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <WifiOff className='mr-2 h-5 w-5 text-amber-500' />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>You&apos;re offline — browsing cached data</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                        <MobileNav />
                    </div>
                </div>
            </div>
        </header>
    );
}
