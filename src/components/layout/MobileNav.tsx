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
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';
import { LogOut } from 'lucide-react';

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
                <SheetContent className='flex w-[70%] flex-col border-border bg-card p-0 text-card-foreground'>
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
                    <SheetFooter className='bg-muted/20 mt-auto flex flex-col gap-4 border-t border-border p-6 sm:justify-start'>
                        {!isPending && session?.user ? (
                            // LOGGED IN
                            <div className='flex w-full flex-col gap-6'>
                                <div className='flex items-center gap-3'>
                                    <Avatar className='h-10 w-10 border border-border'>
                                        <AvatarImage
                                            src={session.user.image || ''}
                                            alt={session.user.name || ''}
                                        />
                                        <AvatarFallback>
                                            {session.user.name?.charAt(0) || 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className='flex flex-col overflow-hidden text-left'>
                                        <span className='truncate text-sm font-medium'>
                                            {session.user.name}
                                        </span>
                                        <span className='truncate text-xs text-muted-foreground'>
                                            {session.user.email}
                                        </span>
                                    </div>
                                </div>

                                <div className='flex items-center justify-between'>
                                    <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                                        <ThemeToggle />
                                        <span>Theme</span>
                                    </div>
                                    <Button
                                        variant='destructive'
                                        size='sm'
                                        className='h-9 gap-2 text-foreground'
                                        onClick={() => {
                                            signOut();
                                            setIsMenuOpen(false);
                                        }}
                                    >
                                        <LogOut className='h-4 w-4' />
                                        Sign Out
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            // LOGGED OUT
                            <div className='flex w-full flex-col gap-4'>
                                <Button asChild onClick={() => setIsMenuOpen(false)}>
                                    <Link href='/sign-in'>Sign In</Link>
                                </Button>
                                <div className='mt-2 flex items-center justify-between px-1'>
                                    <span className='text-sm text-muted-foreground'>
                                        Appearance
                                    </span>
                                    <ThemeToggle />
                                </div>
                            </div>
                        )}

                        <div className='text-muted-foreground/50 mt-4 text-center text-xs'>
                            <a
                                href='https://vietle.me'
                                target='_blank'
                                rel='noopener noreferrer'
                                className='hover:text-primary hover:underline'
                            >
                                Made by Viet Le, 2025
                            </a>
                        </div>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
}
