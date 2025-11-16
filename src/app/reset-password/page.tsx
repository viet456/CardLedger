'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { resetPassword } from '@/src/lib/auth-client';
import { Button } from '@/src/components/ui/button';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const res = await resetPassword({ newPassword: password });

        if (res.error) {
            setError(res.error.message || 'Something went wrong.');
        } else {
            router.push('/sign-in');
        }
    }

    return (
        <main className='mx-auto flex h-screen w-full max-w-md flex-col items-center justify-center space-y-4 p-6'>
            <h1 className='text-2xl font-bold'>Reset Password</h1>
            {error && <p className='text-red-500'>{error}</p>}

            <form onSubmit={handleSubmit} className='w-full space-y-4'>
                <div>
                    <label htmlFor='password' className='mb-1 block text-sm font-medium'>
                        New Password <span aria-hidden='true'>*</span>
                        <span className='sr-only'>required</span>
                    </label>
                    <input
                        id='password'
                        type='password'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder='At least 8 characters'
                        required
                        minLength={8}
                        className='w-full rounded-md border border-border bg-card px-3 py-2'
                    />
                </div>
                <Button
                    type='submit'
                    className='w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary-hover'
                >
                    Reset Password
                </Button>
            </form>
        </main>
    );
}
