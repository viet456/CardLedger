'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signUp, authClient } from '@/src/lib/auth-client';
import { Button } from '@/src/components/ui/button';
import { Widget } from '@/src/components/Turnstile';

export default function SignUpPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [username, setUsername] = useState('');
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
    const [checkingUsername, setCheckingUsername] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [submitAttempts, setSubmitAttempts] = useState(0);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        if (username.length < 3) {
            setUsernameAvailable(null);
            return;
        }

        const timer = setTimeout(async () => {
            setCheckingUsername(true);
            try {
                const { data } = await authClient.isUsernameAvailable({
                    username
                });
                setUsernameAvailable(data?.available ?? null);
            } catch (err) {
                console.error('Error checking username:', err);
            } finally {
                setCheckingUsername(false);
            }
        }, 200); // Wait 200ms after user stops typing

        return () => clearTimeout(timer);
    }, [username]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        if (!turnstileToken) {
            setError('Please wait for the security check to complete.');
            return;
        }

        if (username.length < 3 || username.length > 20) {
            setError('Username must be between 3 and 20 characters');
            return;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
            setError('Username can only contain letters, numbers, underscores, and hyphens');
            return;
        }
        if (usernameAvailable === false) {
            setError('Username is already taken');
            return;
        }

        try {
            const response = await fetch('/api/auth/signup', {
                // Changed from /signin
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email, // These were correct
                    password,
                    username,
                    name,
                    turnstileToken
                })
            });

            const result = await response.json();
            console.log('API RESPONSE:', JSON.stringify(result, null, 2));

            if (!response.ok || result.error) {
                setError(result.error || 'Something went wrong.');
                setSubmitAttempts((attempts) => attempts + 1);
                setTurnstileToken(null);
            } else if (result.token === null && result.user) {
                // Sign-up worked, but verification is required

                // Clear the form
                setName('');
                setUsername('');
                setEmail('');
                setPassword('');

                setError(
                    'Success! Please check your email (' +
                        result.user.email +
                        ') to verify your account before logging in.'
                );

                setSubmitAttempts((attempts) => attempts + 1);
                setTurnstileToken(null);
            } else {
                router.push('/dashboard');
            }
        } catch (error) {
            setError('Network error. Please try again.');
            setSubmitAttempts((attempts) => attempts + 1);
            setTurnstileToken(null);
        }
    }

    return (
        <main className='mx-auto flex h-screen max-w-md flex-col items-center justify-center space-y-4 p-6 text-foreground'>
            <div className='rounded-md border border-border px-12 py-20 shadow-md'>
                <h1 className='mb-2 text-2xl font-bold'>Sign Up</h1>
                {error && <p className='text-red-500'>{error}</p>}

                <form onSubmit={handleSubmit} className='w-full space-y-4'>
                    <div>
                        <label htmlFor='name' className='mb-1 block text-sm font-medium'>
                            Name (optional)
                        </label>
                        <input
                            id='name'
                            name='name'
                            placeholder='John Doe'
                            className='w-full rounded-md border border-border bg-card px-3 py-2 text-card-foreground'
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor='username' className='mb-1 block text-sm font-medium'>
                            Username <span aria-hidden='true'>*</span>
                            <span className='sr-only'>required</span>
                        </label>
                        <input
                            id='username'
                            name='username'
                            placeholder='johndoe'
                            required
                            minLength={3}
                            maxLength={20}
                            pattern='[a-zA-Z0-9_\\-]+'
                            className='w-full rounded-md border border-border bg-card px-3 py-2 text-card-foreground'
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor='email' className='mb-1 block text-sm font-medium'>
                            Email <span aria-hidden='true'>*</span>
                            <span className='sr-only'>required</span>
                        </label>
                        <input
                            id='email'
                            name='email'
                            type='email'
                            placeholder='john@example.com'
                            required
                            className='w-full rounded-md border border-border bg-card px-3 py-2 text-card-foreground'
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
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
                            placeholder='At least 8 characters'
                            required
                            minLength={8}
                            className='w-full rounded-md border border-border bg-card px-3 py-2 text-card-foreground'
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <Widget onTokenChange={setTurnstileToken} resetTrigger={submitAttempts} />
                    <Button
                        type='submit'
                        disabled={
                            !turnstileToken ||
                            !email ||
                            password.length < 8 ||
                            username.length < 3 ||
                            usernameAvailable === false ||
                            checkingUsername
                        }
                        className='w-full rounded-md border border-border bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary-hover'
                    >
                        Create Account
                    </Button>
                </form>
            </div>
        </main>
    );
}
