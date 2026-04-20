// src/app/~offline/page.tsx
export default function OfflineFallback() {
    return (
        <main className="flex min-h-[50vh] flex-col items-center justify-center p-4 text-center">
            <h1 className="text-4xl font-bold tracking-tight">You are offline.</h1>
            <p className="mt-4 text-muted-foreground">
                CardLedger is running in local-first mode. 
                You can still browse your collection and view downloaded cards.
            </p>
        </main>
    );
}