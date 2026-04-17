import { createAuthClient } from 'better-auth/react';
import { usernameClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_APP_URL || 'https://www.cardledger.io',
    plugins: [usernameClient()]
});

// Do not export anything else!
