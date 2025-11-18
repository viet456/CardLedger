'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/src/lib/auth-client';
import { Button } from '@/src/components/ui/button';
import Link from 'next/link';
import { Widget } from '@/src/components/Turnstile';

export default function SignInPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loginAttempts, setLoginAttempts] = useState(0);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        // Check for Cloudflare token before submitting form
        if (!turnstileToken) {
            setError('Please complete the security check.');
            return;
        }

        const isEmail = identifier.includes('@');
        try {
            const response = await fetch('/api/auth/signin', {
                // Changed from /signup
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identifier,
                    password,
                    turnstileToken
                })
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                setError(result.error || 'Something went wrong.');
                setLoginAttempts((attempts) => attempts + 1);
                setTurnstileToken(null);
            } else {
                router.push('/dashboard');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        }
    }

    return (
        <main className='mx-auto flex h-screen w-full max-w-md flex-col items-center justify-center space-y-4 p-6 text-foreground'>
            <div className='rounded-md border border-border px-12 py-20 shadow-md'>
                <h1 className='mb-2 text-2xl font-bold'>Sign In</h1>
                {error && <p className='text-red-500'>{error}</p>}

                <form onSubmit={handleSubmit} className='w-full space-y-4'>
                    <div>
                        <label htmlFor='identifier' className='mb-1 block text-sm font-medium'>
                            Email or Username <span aria-hidden='true'>*</span>
                            <span className='sr-only'>required</span>
                        </label>
                        <input
                            id='identifier'
                            name='identifier'
                            placeholder='email@example.com or username'
                            required
                            className='w-full rounded-md border border-border bg-card px-3 py-2 text-card-foreground'
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor='password' className='mb-1 block text-sm font-medium'>
                            Password <span aria-hidden='true'>*</span>
                            <span className='sr-only'>required</span>
                        </label>
                        <input
                            id='password'
                            name='password'
                            type='password'
                            placeholder='Password'
                            required
                            minLength={8}
                            className='w-full rounded-md border border-border bg-card px-3 py-2 text-card-foreground'
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <Widget onTokenChange={setTurnstileToken} resetTrigger={loginAttempts} />

                    <Button
                        type='submit'
                        disabled={!turnstileToken || !identifier || password.length < 8}
                        className='w-full rounded-md border border-border bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary-hover'
                    >
                        Sign In
                    </Button>
                    <Link href='/forgot-password' className='text-sm text-blue-500 hover:underline'>
                        Forgot password
                    </Link>
                </form>
            </div>
        </main>
    );
}
