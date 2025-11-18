'use client';
import { useState } from 'react';
import { Button } from '@/src/components/ui/button';
import { Widget } from '@/src/components/Turnstile';
import { forgetPassword } from '@/src/lib/auth-client';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
    const [submitAttempts, setSubmitAttempts] = useState(0);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setMessage(null);

        // Check for Cloudflare token before submitting form
        if (!turnstileToken) {
            setError('Please complete the security check.');
            return;
        }

        try {
            const response = await forgetPassword({
                email,
                redirectTo: '/reset-password',
                fetchOptions: {
                    headers: {
                        'x-captcha-response': turnstileToken
                    }
                }
            });
            if (response.error) {
                setError(response.error.message || 'Something went wrong.');
                setSubmitAttempts((attempts) => attempts + 1);
                setTurnstileToken(null);
            } else {
                setMessage('Check your email for a password reset link.');
            }
        } catch (error) {
            setError('An unexpected error occurred.');
            setSubmitAttempts((attempts) => attempts + 1);
            setTurnstileToken(null);
        }
    }

    return (
        <main className='mx-auto flex h-screen w-full max-w-md flex-col items-center justify-center space-y-4 p-6'>
            <div className='rounded-md border border-border px-12 py-20 shadow-md'>
                <h1 className='mb-2 text-2xl font-bold'>Forgot Password</h1>
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
                    <Widget onTokenChange={setTurnstileToken} resetTrigger={submitAttempts} />
                    <Button
                        type='submit'
                        disabled={!turnstileToken || !email}
                        className='w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:bg-primary-hover'
                    >
                        Send Reset Link
                    </Button>
                </form>
            </div>
        </main>
    );
}
