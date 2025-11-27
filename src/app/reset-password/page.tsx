import { Suspense } from 'react';
import ResetPasswordForm from './ResetPasswordForm';

export default function ResetPasswordPage() {
    return (
        <Suspense
            fallback={
                <main className='mx-auto flex h-screen w-full max-w-md flex-col items-center justify-center space-y-4 p-6'>
                    <div className='rounded-md border border-border px-12 py-20 shadow-md'>
                        <h1 className='text-2xl font-bold'>Reset Password</h1>
                        <p className='mt-4 text-sm text-muted-foreground'>Loading...</p>
                    </div>
                </main>
            }
        >
            <ResetPasswordForm />
        </Suspense>
    );
}
