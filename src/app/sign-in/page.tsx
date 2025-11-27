import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/src/components/ui/card';
import { SignInForm } from './_components/SignInForm';
import { SignUpForm } from './_components/SignUpForm';

export default function AuthPage() {
    return (
        <div className='flex min-h-[80vh] flex-col items-center justify-start p-4'>
            <Tabs defaultValue='signin' className='w-full max-w-[400px]'>
                <TabsList className='mb-4 grid w-full grid-cols-2'>
                    <TabsTrigger value='signin'>Sign In</TabsTrigger>
                    <TabsTrigger value='signup'>Sign Up</TabsTrigger>
                </TabsList>

                <TabsContent value='signin'>
                    <Card>
                        <CardHeader>
                            <CardTitle>Welcome Back</CardTitle>
                            <CardDescription>
                                Enter your credentials to access your collection.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SignInForm />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value='signup'>
                    <Card>
                        <CardHeader>
                            <CardTitle>Create Account</CardTitle>
                            <CardDescription>
                                Start tracking your card collection today.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SignUpForm />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
