'use client';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/src/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';
import { Button } from '@/src/components/ui/button';
import { LayoutDashboard, LogOut } from 'lucide-react';
import { authClient } from '@/src/lib/auth-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthSession } from '@/src/providers/SessionProvider';

interface UserNavProps {
    user: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
    };
}

export function UserNav({ user: serverUser }: UserNavProps) {
    const router = useRouter();
    
    const { data: sessionData } = useAuthSession();
    const activeUser = sessionData?.user;

    if (!activeUser) {
        return null; 
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant='ghost' className='relative h-9 w-9 rounded-full'>
                    <Avatar className='h-9 w-9 border border-border'>
                        <AvatarImage src={activeUser.image || ''} alt={activeUser.name || ''} />
                        <AvatarFallback>{activeUser.name?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className='w-56' align='end' forceMount>
                <DropdownMenuLabel className='font-normal'>
                    <div className='flex flex-col space-y-1'>
                        <p className='text-sm font-medium leading-none'>{activeUser.name}</p>
                        <p className='text-xs leading-none text-muted-foreground'>{activeUser.email}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuItem asChild>
                    <Link href='/dashboard' className='flex w-full cursor-pointer items-center'>
                        <LayoutDashboard className='mr-2 h-4 w-4' />
                        <span>Dashboard</span>
                    </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
    className='cursor-pointer text-red-600 focus:text-red-600'
    onSelect={async (e) => {
        e.preventDefault(); 
        
        await authClient.signOut();
        
        if (typeof window !== 'undefined' && 'caches' in window) {
            try {
                const cacheKeys = await caches.keys();
                await Promise.all(cacheKeys.map(key => caches.delete(key)));
                console.log('Cleared SW cache for logout');
            } catch (err) {
                console.error('Failed to clear cache', err);
            }
        }
        
        window.location.href = '/';
    }}
>
    <LogOut className='mr-2 h-4 w-4' />
    <span>Sign out</span>
</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}