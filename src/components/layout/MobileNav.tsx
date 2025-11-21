'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HeaderSearchBar } from '../search/HeaderSearchBar';
import { Menu, X } from 'lucide-react';
import { Button } from '../ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetClose,
    SheetFooter
} from '@/src/components/ui/sheet';
import { navItems } from './Header';
import { ThemeToggle } from './ThemeToggle';
import { useSession, signOut } from '@/src/lib/auth-client';

const NavLink = ({
    href,
    label,
    onClick
}: {
    href: string;
    label: string;
    onClick: () => void;
}) => {
    const pathname = usePathname();
    const isActive = pathname === href;

    return (
        <Link
            href={href}
            className={`text-xl transition-colors hover:text-slate-300 ${
                isActive ? 'font-semibold text-accent-foreground' : 'text-muted-foreground'
            } hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground`}
            onClick={onClick}
        >
            {label}
        </Link>
    );
};

export function MobileNav() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { data: session, isPending } = useSession();

    return (
        <div className='md:hidden'>
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <SheetTrigger aria-label='Open navigation menu'>
                    <Menu className='h-8 w-8' />
                </SheetTrigger>
                <SheetContent className='flex w-[70%] flex-col border-border bg-card text-card-foreground'>
                    <SheetHeader className='flex flex-row items-center justify-between p-4'>
                        <SheetTitle className='text-2xl text-primary'>
                            <Link href='/' className='text-3xl'>
                                CardLedger
                            </Link>
                        </SheetTitle>
                        <SheetDescription className='sr-only'>
                            Main navigation menu.
                        </SheetDescription>

                        <SheetClose asChild>
                            <Button
                                variant='secondary'
                                size='icon'
                                className='absolute right-4 top-4 h-8 w-8 rounded-sm bg-slate-400 p-0 hover:bg-slate-500 hover:ring-1 hover:ring-ring focus:ring-1 focus:ring-ring'
                            >
                                <X className='!h-6 !w-6 text-slate-800' />
                                <span className='sr-only'>Close</span>
                            </Button>
                        </SheetClose>
                    </SheetHeader>

                    <div className='p-4'>
                        <HeaderSearchBar onSuggestionClick={() => setIsMenuOpen(false)} />
                    </div>

                    <div className='mt-4 flex flex-grow flex-col gap-6 overflow-y-auto p-8'>
                        {navItems.map((item) => (
                            <NavLink
                                key={item.href}
                                href={item.href}
                                label={item.label}
                                onClick={() => setIsMenuOpen(false)}
                            />
                        ))}
                    </div>
                    {/* Loading, button skeletons */}
                    {isPending && (
                        <div className='mx-2 flex flex-col gap-2'>
                            <div className='h-9 w-20 animate-pulse rounded-md bg-muted'></div>
                            <div className='h-9 w-20 animate-pulse rounded-md bg-muted'></div>
                        </div>
                    )}
                    {/* Logged out */}
                    {!session?.user && !isPending && (
                        <div className='mx-2 flex flex-col gap-2'>
                            <Button variant='ghost' asChild>
                                <Link href='/sign-in' onClick={() => setIsMenuOpen(false)}>
                                    Sign In
                                </Link>
                            </Button>

                            <Button asChild>
                                <Link href='/sign-up' onClick={() => setIsMenuOpen(false)}>
                                    Sign Up
                                </Link>
                            </Button>
                        </div>
                    )}
                    {/* Logged in */}
                    {!isPending && session?.user && (
                        <div className='gap-2'>
                            <div>
                                <Button variant='ghost' asChild>
                                    <Link href='/dashboard' onClick={() => setIsMenuOpen(false)}>
                                        Dashboard
                                    </Link>
                                </Button>
                            </div>

                            <Button
                                variant='outline'
                                onClick={() => {
                                    (signOut(), setIsMenuOpen(false));
                                }}
                            >
                                Sign Out
                            </Button>
                        </div>
                    )}
                    <SheetFooter className='bottom-4 left-0 right-0 mt-auto flex w-full flex-row items-center justify-between p-4'>
                        <ThemeToggle />
                        <a
                            href='https://vietle.me'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-center text-sm text-muted-foreground'
                        >
                            Made by Viet Le, 2025
                        </a>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
}
