'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MobileNav } from './MobileNav';
import { Menu } from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger
} from '@/components/ui/sheet';

const navItems = [
    { href: '/', label: 'Home' },
    { href: '/cards', label: 'Cards' }
];

export function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const pathname = usePathname();

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
                className={`transition-colors hover:text-slate-300 ${
                    isActive ? 'font-semibold text-white' : 'text-slate-200'
                }`}
                onClick={() => isMobile && setIsMenuOpen(false)}
            >
                {label}
            </Link>
        );
    };

    return (
        <header className='sticky top-0 z-50 bg-slate-700'>
            <div className='flex h-16 w-full max-w-7xl items-center justify-between px-4 text-xl text-white'>
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
                {/* Mobile navigation*/}
                <MobileNav />
            </div>
        </header>
    );
}
