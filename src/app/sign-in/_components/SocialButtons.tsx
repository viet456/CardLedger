'use client';
import { signIn } from '@/src/lib/auth-client';
import { Button } from '@/src/components/ui/button';
import { toast } from 'sonner';
import { useState } from 'react';

export function SocialButtons() {
    const [isPending, setIsPending] = useState(false);

    const handleSocialSignIn = async (provider: 'google' | 'discord') => {
        setIsPending(true);
        await signIn.social({
            provider: provider,
            callbackURL: '/dashboard', // Redirect after success
            onError: (ctx: { error: { message: string } }) => {
                toast.error(ctx.error.message || 'Social sign-in failed');
                setIsPending(false);
            }
        });
    };

    return (
        <div className='flex w-full flex-col gap-2'>
            {/* GOOGLE */}
            <Button
                variant='outline'
                type='button'
                disabled={isPending}
                onClick={() => handleSocialSignIn('google')}
                className='w-full gap-2'
            >
                <svg className='h-4 w-4' viewBox='0 0 24 24'>
                    <path
                        d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
                        fill='#4285F4'
                    />
                    <path
                        d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
                        fill='#34A853'
                    />
                    <path
                        d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
                        fill='#FBBC05'
                    />
                    <path
                        d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
                        fill='#EA4335'
                    />
                </svg>
                Continue with Google
            </Button>

            {/* DISCORD */}
            <Button
                variant='outline'
                type='button'
                disabled={isPending}
                onClick={() => handleSocialSignIn('discord')}
                className='w-full gap-2 hover:border-[#5865F2] hover:bg-[#5865F2]/10 hover:text-[#5865F2]'
            >
                <svg className='h-4 w-4 fill-current' viewBox='0 0 127.14 96.36'>
                    <path d='M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c.63-15.02-2.08-41.58-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z' />
                </svg>
                Continue with Discord
            </Button>
        </div>
    );
}
