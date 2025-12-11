import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'https://www.cardledger.io',
    plugins: [usernameClient()]
});
export const { signIn, signUp, signOut, useSession, resetPassword, forgotPassword } =
    authClient as any;

export const requestPasswordReset = authClient.requestPasswordReset;
