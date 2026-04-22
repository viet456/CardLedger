'use client';

import { useParams } from 'next/navigation';
import { OfflineCardView } from '../../~offline/OfflineCardView';

export default function CardError({ error, reset }: { error: Error; reset: () => void }) {
    const params = useParams();
    const cardId = params?.cardId as string | undefined;

    // Evaluate synchronously to prevent the UI flicker.
    // If it's a fetch error in App Router, it's an offline RSC failure.
    const isOfflineError = 
        (typeof navigator !== 'undefined' && !navigator.onLine) || 
        error.message.includes('fetch') || 
        error.message.includes('Failed to fetch');

    // Instantly return the local engine. No useEffect flash.
    if (isOfflineError && cardId) {
        return <OfflineCardView cardId={cardId} />;
    }

    return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center p-4 text-center">
            <h2 className="text-2xl font-bold">Something went wrong!</h2>
            <p className="mt-2 text-muted-foreground">{error.message}</p>
            <button 
                onClick={() => reset()} 
                className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground"
            >
                Try again
            </button>
        </div>
    );
}