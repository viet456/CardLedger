'use client';
import { useEffect } from 'react';

export function ServiceWorkerRegistry() {
    useEffect(() => {
        // Run check to ensure we are in the browser and SW is supported
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            // Reload when a new service worker takes control — this ensures
            // the page picks up the latest chunk hashes instead of referencing
            // stale precache entries that no longer exist.
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                // Only reload if we weren't the initial page load controller
                window.location.reload();
            });

            // Register immediately, bypassing the 'load' event listener
            navigator.serviceWorker.register('/sw.js').then(
                function (registration) {
                    console.log('[ServiceWorker] Registration successful with scope: ', registration.scope);
                    // Trigger an immediate update check on mount
                    registration.update();
                },
                function (err) {
                    console.error('[ServiceWorker] Registration failed: ', err);
                }
            );
        }
    }, []);

    return null;
}
