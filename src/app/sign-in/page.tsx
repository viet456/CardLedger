import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { SignInForm } from './_components/SignInForm';
import { SignUpForm } from './_components/SignUpForm';
import { SocialButtons } from './_components/SocialButtons';
import { AuthDivider } from './_components/AuthDivider';

export default function AuthPage() {
    return (
        <div className='flex min-h-[80vh] flex-col items-center justify-start p-4 pt-12'>
            <div className='w-full max-w-[400px] space-y-6'>
                {/* Global Auth Section (Visible for both modes) */}
                <div className='space-y-2 text-center'>
                    <h1 className='text-2xl font-bold tracking-tight'>Welcome to CardLedger</h1>
                    <p className='text-muted-foreground'>Sign in to manage your collection</p>
                </div>

                <div className='rounded-lg border bg-card p-6 text-card-foreground shadow-sm'>
                    {/* Social Login First */}
                    <SocialButtons />

                    <AuthDivider />

                    {/* Tabs for Email/Password Only */}
                    <Tabs defaultValue='signin' className='mt-4 w-full'>
                        <TabsList className='mb-4 grid w-full grid-cols-2'>
                            <TabsTrigger value='signin'>Sign In</TabsTrigger>
                            <TabsTrigger value='signup'>Sign Up</TabsTrigger>
                        </TabsList>

                        <TabsContent value='signin'>
                            <SignInForm />
                        </TabsContent>

                        <TabsContent value='signup'>
                            <SignUpForm />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
