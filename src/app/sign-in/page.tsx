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

        const res = await signIn.email({
            email: formData.get('email') as string,
            password: formData.get('password') as string
        });

        if (res.error) {
            setError(res.error.message || 'Something went wrong.');
        } else {
            router.push('/dashboard');
        }
    }

    return (
        <main className='mx-auto flex h-screen max-w-md flex-col items-center justify-center space-y-4 p-6 text-white'>
            <h1 className='text-2xl font-bold'>Sign In</h1>
            {error && <p className='text-red-500'>{error}</p>}

            <form onSubmit={handleSubmit} className='space-y-4'>
                <input
                    name='email'
                    type='email'
                    placeholder='Email'
                    required
                    className='w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2'
                />
                <input
                    name='password'
                    type='password'
                    placeholder='Password'
                    required
                    className='w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2'
                />
                <button
                    type='submit'
                    className='w-full rounded-md bg-white px-4 py-2 font-medium text-black hover:bg-gray-200'
                >
                    Sign In
                </button>
            </form>
        </main>
    );
}
