'use client';
import Link, { LinkProps } from 'next/link';
import { useRouter } from 'next/navigation';
import React from 'react';

interface TransitionLinkProps extends LinkProps {
    children: React.ReactNode;
    className?: string;
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function TransitionLink({ children, href, ...props }: TransitionLinkProps) {
    const router = useRouter();

    const handleTransition = async (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();

        // Fallback for browsers without View Transition support (Safari/Firefox)
        if (!document.startViewTransition) {
            router.push(href.toString());
            return;
        }

        document.startViewTransition(async () => {
            router.push(href.toString());
            await sleep(0);
        });
    };

    return (
        <Link {...props} href={href} onClick={handleTransition}>
            {children}
        </Link>
    );
}
