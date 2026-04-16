'use client';
import { useEffect } from 'react';

export function ServiceWorkerRegistry() {
    useEffect(() => {
        // Run check to ensure we are in the browser and SW is supported
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            
            // Register immediately, bypassing the 'load' event listener
            navigator.serviceWorker.register('/sw.js').then(
                function (registration) {
                    console.log('[ServiceWorker] Registration successful with scope: ', registration.scope);
                },
                function (err) {
                    console.error('[ServiceWorker] Registration failed: ', err);
                }
            );
        }
    }, []);

    return null;
}