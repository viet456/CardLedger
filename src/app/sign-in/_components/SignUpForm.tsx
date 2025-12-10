'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signUp, authClient } from '@/src/lib/auth-client';
import { Button } from '@/src/components/ui/button';
import { Widget } from '@/src/components/Turnstile';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';

export function SignUpForm() {
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
                const { data } = await authClient.isUsernameAvailable({ username });
                setUsernameAvailable(data?.available ?? null);
            } catch (err) {
                console.error('Error checking username:', err);
            } finally {
                setCheckingUsername(false);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [username]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        if (!turnstileToken) return setError('Please wait for the security check.');
        if (username.length < 3 || username.length > 20)
            return setError('Username must be 3-20 chars');
        if (!/^[a-zA-Z0-9_-]+$/.test(username)) return setError('Invalid characters in username');
        if (usernameAvailable === false) return setError('Username is taken');

        try {
            const response = await signUp.email({
                email,
                password,
                username,
                name,
                fetchOptions: { headers: { 'x-captcha-response': turnstileToken } }
            });

            if (response.error) {
                setError(response.error.message || 'Something went wrong.');
                setSubmitAttempts((p) => p + 1);
                setTurnstileToken(null);
            } else if (response.data.token === null && response.data.user) {
                setName('');
                setUsername('');
                setEmail('');
                setPassword('');
                setError(`Success! Please verify email: ${response.data.user.email}`);
                setSubmitAttempts((p) => p + 1);
                setTurnstileToken(null);
            } else {
                window.location.href = '/dashboard';
            }
        } catch (error) {
            setError('Network error.');
            setSubmitAttempts((p) => p + 1);
            setTurnstileToken(null);
        }
    }

    return (
        <div className='space-y-4 py-4'>
            {error && <p className='text-destructive text-sm font-medium'>{error}</p>}
            <form onSubmit={handleSubmit} className='space-y-4'>
                <div className='space-y-2'>
                    <Label htmlFor='signup-name'>Name (Optional)</Label>
                    <Input
                        id='signup-name'
                        placeholder='John Doe'
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div className='space-y-2'>
                    <Label htmlFor='signup-username'>Username</Label>
                    <div className='relative'>
                        <Input
                            id='signup-username'
                            placeholder='johndoe'
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className={
                                usernameAvailable === false
                                    ? 'border-red-500 focus-visible:ring-red-500'
                                    : ''
                            }
                        />
                        <div className='absolute right-3 top-2.5 text-xs'>
                            {checkingUsername && <span className='text-muted-foreground'>...</span>}
                            {!checkingUsername && usernameAvailable === true && (
                                <span className='text-green-500'>✔</span>
                            )}
                            {!checkingUsername && usernameAvailable === false && (
                                <span className='text-red-500'>✖</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className='space-y-2'>
                    <Label htmlFor='signup-email'>Email</Label>
                    <Input
                        id='signup-email'
                        type='email'
                        placeholder='name@example.com'
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
                <div className='space-y-2'>
                    <Label htmlFor='signup-password'>Password</Label>
                    <Input
                        id='signup-password'
                        type='password'
                        placeholder='Min 8 chars'
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <div className='flex justify-center'>
                    <Widget onTokenChange={setTurnstileToken} resetTrigger={submitAttempts} />
                </div>

                <Button
                    type='submit'
                    className='w-full'
                    disabled={
                        !turnstileToken || !email || password.length < 8 || !usernameAvailable
                    }
                >
                    Create Account
                </Button>
            </form>
        </div>
    );
}
