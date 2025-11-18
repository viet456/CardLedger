import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';
import { useRef, useEffect } from 'react';

const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!;

interface WidgetProps {
    onTokenChange: (token: string | null) => void;
    resetTrigger?: number;
}

export function Widget({ onTokenChange, resetTrigger }: WidgetProps) {
    const turnstileRef = useRef<TurnstileInstance>(null);

    useEffect(() => {
        if (resetTrigger && resetTrigger > 0) {
            turnstileRef.current?.reset();
        }
    }, [resetTrigger]);

    return (
        <div className='min-h-[72px] min-w-[300px]'>
            <Turnstile
                ref={turnstileRef}
                siteKey={sitekey}
                onSuccess={(token) => {
                    onTokenChange(token);
                }}
                onError={() => {
                    onTokenChange(null);
                }}
                onExpire={() => {
                    onTokenChange(null);
                }}
            />
        </div>
    );
}
