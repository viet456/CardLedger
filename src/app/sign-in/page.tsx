'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/src/lib/auth-client';

export default function SignInPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const formData = new FormData(e.currentTarget);
        const identifier = formData.get('identifier') as string;
        const password = formData.get('password') as string;
        const isEmail = identifier.includes('@');
        const res = isEmail
            ? await signIn.email({ email: identifier, password })
            : await signIn.username({ username: identifier, password });

        if (res.error) {
            setError(res.error.message || 'Something went wrong.');
        } else {
            router.push('/dashboard');
        }
    }

    return (
        <main className='mx-auto flex h-screen w-full max-w-md flex-col items-center justify-center space-y-4 p-6 text-foreground'>
            <h1 className='text-2xl font-bold'>Sign In</h1>
            {error && <p className='text-red-500'>{error}</p>}

            <form onSubmit={handleSubmit} className='w-full space-y-4'>
                <div>
                    <label htmlFor='identifier' className='mb-1 block text-sm font-medium'>
                        Email or Username <span aria-hidden='true'>*</span>
                    </label>
                    <input
                        id='identifier'
                        name='identifier'
                        placeholder='email@example.com or username'
                        required
                        className='w-full rounded-md border border-border bg-card px-3 py-2 text-card-foreground'
                    />
                </div>
                <div>
                    <label htmlFor='password' className='mb-1 block text-sm font-medium'>
                        Password <span aria-hidden='true'>*</span>
                    </label>
                    <input
                        id='password'
                        name='password'
                        type='password'
                        placeholder='Password'
                        required
                        className='w-full rounded-md border border-border bg-card px-3 py-2 text-card-foreground'
                    />
                </div>
                <button
                    type='submit'
                    className='w-full rounded-md border border-border bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary-hover'
                >
                    Sign In
                </button>
            </form>
        </main>
    );
}
