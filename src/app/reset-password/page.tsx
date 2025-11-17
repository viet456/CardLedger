'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resetPassword } from '@/src/lib/auth-client';
import { Button } from '@/src/components/ui/button';
import { Widget } from '@/src/components/Turnstile';

export default function ResetPasswordPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [resetToken, setResetToken] = useState<string | null>(null);

    useEffect(() => {
        const token = searchParams.get('token');
        if (token) {
            setResetToken(token);
        } else {
            setError('Invalid or missing reset token');
        }
    }, [searchParams]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!turnstileToken) {
            setError('Please complete the security check.');
            return;
        }
        if (!resetToken) {
            setError('Invalid or missing reset token.');
            return;
        }

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    newPassword: password,
                    resetToken,
                    turnstileToken
                })
            });
            const result = await response.json();

            if (!response.ok || result.error) {
                setError(result.error || 'Something went wrong.');
            } else {
                router.push('/sign-in');
            }
        } catch (error) {
            setError('An unexpected error occurred.');
        }
    }

    return (
        <main className='mx-auto flex h-screen w-full max-w-md flex-col items-center justify-center space-y-4 p-6'>
            <div className='rounded-md border border-border px-12 py-20 shadow-md'>
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
                    <Widget onTokenChange={setTurnstileToken} />
                    <Button
                        type='submit'
                        disabled={!turnstileToken || !resetToken || password.length < 8}
                        className='w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary-hover'
                    >
                        Reset Password
                    </Button>
                </form>
            </div>
        </main>
    );
}
