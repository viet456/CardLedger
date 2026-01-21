import Link from 'next/link';
import { Globe, AtSign } from 'lucide-react';

export function Footer() {
    return (
        <footer className='border-t border-border bg-muted/30 pb-12 pt-10 text-muted-foreground'>
            <div className='container mx-auto px-4'>
                <div className='grid gap-8 md:grid-cols-2 lg:grid-cols-4'>
                    {/* Brand Section */}
                    <div className='col-span-1 flex flex-col gap-4 lg:col-span-2'>
                        <div>
                            <span className='text-lg font-bold text-foreground'>CardLedger</span>
                            <p className='mt-2 max-w-xs text-sm'>
                                The operating system for serious collectors. Track prices, manage
                                assets, and visualize your portfolio.
                            </p>
                        </div>
                        <p className='text-xs'>© 2026 CardLedger. All rights reserved.</p>
                    </div>

                    {/* Quick Links */}
                    <div className='flex flex-col gap-2'>
                        <h3 className='font-semibold text-foreground'>Product</h3>
                        <Link
                            href='/cards'
                            className='text-sm hover:text-foreground hover:underline'
                        >
                            Search Database
                        </Link>
                        <Link
                            href='/dashboard'
                            className='text-sm hover:text-foreground hover:underline'
                        >
                            Dashboard
                        </Link>
                        <Link
                            href='/sets'
                            className='text-sm hover:text-foreground hover:underline'
                        >
                            Browse Sets
                        </Link>
                    </div>

                    {/* Creator Section */}
                    <div className='flex flex-col gap-2'>
                        <h3 className='font-semibold text-foreground'>Created By</h3>
                        <a
                            href='https://vietle.me'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='flex items-center gap-2 text-sm hover:text-foreground hover:underline'
                        >
                            <Globe className='h-4 w-4' /> Viet Le
                        </a>
                        <a
                            href='https://x.com/vietle683'
                            target='_blank'
                            rel='noopener noreferrer'
                            className='flex items-center gap-2 text-sm hover:text-foreground hover:underline'
                        >
                            <AtSign className='h-4 w-4' />
                            vietle683
                        </a>
                    </div>
                </div>

                {/* Legal / Disclaimer Section */}
                <div className='mt-12 flex flex-col gap-2 opacity-60'>
                    <p className='text-[10px] leading-tight'>
                        The literal and graphical information presented on this website about the
                        Pokémon Trading Card Game, including card text and images, are copyright The
                        Pokémon Company (Pokémon), Nintendo, Game Freak, Creatures, and/or Wizards
                        of the Coast.
                    </p>
                    <p className='text-[10px] leading-tight'>
                        This website is not produced by, endorsed by, supported by, or affiliated
                        with The Pokémon Company (Pokémon), Nintendo, Game Freak, Creatures, or
                        Wizards of the Coast.
                    </p>
                </div>
            </div>
        </footer>
    );
}
