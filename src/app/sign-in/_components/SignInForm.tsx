'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from '@/src/lib/auth-client';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import Link from 'next/link';
import { Widget } from '@/src/components/Turnstile';
import { SocialButtons } from './SocialButtons';
import { AuthDivider } from './AuthDivider';

export function SignInForm() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loginAttempts, setLoginAttempts] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!turnstileToken) {
            setError('Please complete the security check.');
            return;
        }

        setIsLoading(true);
        const isEmail = identifier.includes('@');

        try {
            const response = isEmail
                ? await signIn.email({
                      email: identifier,
                      password,
                      fetchOptions: { headers: { 'x-captcha-response': turnstileToken } }
                  })
                : await signIn.username({
                      username: identifier,
                      password,
                      fetchOptions: { headers: { 'x-captcha-response': turnstileToken } }
                  });

            if (response.error) {
                setError(response.error.message || 'Invalid credentials.');
                setLoginAttempts((p) => p + 1);
                setTurnstileToken(null); // Force captcha reset on error
            } else {
                router.push('/dashboard');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className='grid gap-6 py-4'>
            {error && (
                <div className='text-destructive bg-destructive/10 rounded-md p-3 text-sm font-medium'>
                    {error}
                </div>
            )}
            <SocialButtons />
            <AuthDivider />
            <form onSubmit={handleSubmit} className='space-y-4'>
                <div className='space-y-2'>
                    <Label htmlFor='identifier'>Email or Username</Label>
                    <Input
                        id='identifier'
                        placeholder='name@example.com'
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                        disabled={isLoading}
                    />
                </div>

                <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                        <Label htmlFor='password'>Password</Label>
                        <Link
                            href='/forgot-password'
                            className='text-xs text-muted-foreground hover:text-primary hover:underline'
                        >
                            Forgot password?
                        </Link>
                    </div>
                    <Input
                        id='password'
                        type='password'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        disabled={isLoading}
                    />
                </div>

                <div className='flex justify-center'>
                    <Widget onTokenChange={setTurnstileToken} resetTrigger={loginAttempts} />
                </div>

                <Button
                    type='submit'
                    className='w-full'
                    disabled={!turnstileToken || !identifier || password.length < 8 || isLoading}
                >
                    {isLoading ? 'Signing In...' : 'Sign In'}
                </Button>
            </form>
        </div>
    );
}
