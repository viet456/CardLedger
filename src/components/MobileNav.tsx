'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Button } from './ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetClose,
    SheetFooter
} from '@/components/ui/sheet';

const navItems = [
    { href: '/', label: 'Home' },
    { href: '/cards', label: 'Cards' }
];

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
                isActive ? 'font-semibold text-white' : 'text-slate-200'
            }`}
            onClick={onClick}
        >
            {label}
        </Link>
    );
};

export function MobileNav() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <div className='md:hidden'>
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <SheetTrigger aria-label='Open navigation menu'>
                    <Menu className='h-8 w-8' />
                </SheetTrigger>
                <SheetContent className='w-[70%] border-l-slate-600 bg-slate-700 text-slate-200'>
                    <SheetHeader className='flex flex-row items-center justify-between p-4'>
                        <SheetTitle className='text-2xl text-white'>
                            <Link href='/' className='text-3xl'>
                                CardLedger
                            </Link>
                        </SheetTitle>
                        <SheetDescription className='sr-only'>
                            Main navigation menu.
                        </SheetDescription>

                        <SheetClose asChild>
                            <Button
                                variant='ghost'
                                size='icon'
                                className='absolute top-4 right-4 h-8 w-8 rounded-sm bg-slate-400 p-0 hover:bg-slate-500'
                            >
                                <X className='!h-6 !w-6 text-slate-800' />
                                <span className='sr-only'>Close</span>
                            </Button>
                        </SheetClose>
                    </SheetHeader>

                    <div className='mt-4 flex flex-col gap-6 p-8'>
                        {navItems.map((item) => (
                            <NavLink
                                key={item.href}
                                href={item.href}
                                label={item.label}
                                onClick={() => setIsMenuOpen(false)}
                            />
                        ))}
                    </div>
                    <SheetFooter className='p-4'>
                        <a
                            href='https://vietle.me'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='text-center text-sm text-slate-400'
                        >
                            Made by Viet Le, 2025
                        </a>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
}
