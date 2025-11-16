'use client';
import { useState } from 'react';
import { forgetPassword } from '@/src/lib/auth-client';
import { Button } from '@/src/components/ui/button';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setMessage(null);

        const res = await forgetPassword({ email, redirectTo: '/reset-password' });

        if (res.error) {
            setError(res.error.message || 'Something went wrong.');
        } else {
            setMessage('Check your email for a password reset link.');
        }
    }

    return (
        <main className='mx-auto flex h-screen w-full max-w-md flex-col items-center justify-center space-y-4 p-6'>
            <h1 className='text-2xl font-bold'>Forgot Password</h1>
            {error && <p className='text-red-500'>{error}</p>}
            {message && <p className='text-green-500'>{message}</p>}

            <form onSubmit={handleSubmit} className='w-full space-y-4'>
                <div>
                    <label htmlFor='email' className='mb-1 block text-sm font-medium'>
                        Email <span aria-hidden='true'>*</span>
                        <span className='sr-only'>required</span>
                    </label>
                    <input
                        id='email'
                        type='email'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder='email@example.com'
                        required
                        className='w-full rounded-md border border-border bg-card px-3 py-2'
                    />
                </div>
                <Button
                    type='submit'
                    className='w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary-hover'
                >
                    Send Reset Link
                </Button>
            </form>
        </main>
    );
}
