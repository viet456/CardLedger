'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import r2ImageLoader from '@/src/lib/loader';

const FALLBACK_IMAGE = '/images/card-placeholder.avif';

interface CardImageDisplayProps {
    img: string | null | undefined;
    name: string;
    id: string;
}

export function CardImageDisplay({ img, name, id }: CardImageDisplayProps) {
    const [isHighResLoaded, setIsHighResLoaded] = useState(false);
    
    const [baseError, setBaseError] = useState(false);
    const [highResError, setHighResError] = useState(false);

    useEffect(() => {
        // If we have the preview param, clean it up from the URL bar
        // without refreshing the page
        if (typeof window !== 'undefined' && window.location.search.includes('preview=')) {
            const url = new URL(window.location.href);
            url.searchParams.delete('preview');
            window.history.replaceState(window.history.state, '', url);
        }
    }, []);

    // Only show the gray placeholder if we have NO image, or the low-res completely failed
    if (!img || baseError) {
        return (
            <div className='relative aspect-[2.5/3.5] w-full overflow-hidden rounded-xl bg-muted shadow-lg'>
                <img
                    src={FALLBACK_IMAGE}
                    alt={name}
                    className='h-full w-full object-cover opacity-80'
                    aria-hidden='true'
                />
            </div>
        );
    }

    return (
        <div className='relative aspect-[2.5/3.5] w-full overflow-hidden rounded-xl bg-muted shadow-lg'>
            {/* LAYER 1: Low Res / Cache Match
                Matches the grid sizes='192px' for instant cache hit.
            */}
            <Image
                loader={r2ImageLoader}
                src={img}
                alt={name}
                fill
                sizes='192px'
                className='object-cover'
                onError={() => setBaseError(true)}
            />

            {/* LAYER 2: High Res Overlay  */}
            {!highResError && (
                <Image
                    loader={r2ImageLoader}
                    src={img}
                    alt={name}
                    fill
                    priority
                    sizes='(max-width: 768px) 100vw, 33vw'
                    className={`z-10 object-cover transition-opacity duration-500 ${
                        isHighResLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                    onLoad={() => setIsHighResLoaded(true)}
                    onError={() => setHighResError(true)}
                />
            )}
        </div>
    );
}