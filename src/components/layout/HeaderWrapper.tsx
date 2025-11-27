import { auth } from '@/src/lib/auth';
import { headers } from 'next/headers';
import { Header } from './Header';

export async function HeaderWrapper() {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    const user = session?.user
        ? {
              name: session.user.name,
              email: session.user.email,
              image: session.user.image
          }
        : null;

    return <Header initialUser={user} />;
}
