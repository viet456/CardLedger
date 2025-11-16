import { Turnstile } from '@marsidev/react-turnstile';

const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!;

interface WidgetProps {
    onTokenChange: (token: string | null) => void;
}

export function Widget({ onTokenChange }: WidgetProps) {
    return (
        <div className='min-h-[72px] min-w-[300px]'>
            <Turnstile
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
