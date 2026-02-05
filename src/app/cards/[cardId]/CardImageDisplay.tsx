'use client';

import Image from 'next/image';
import { useState } from 'react';

interface CardImageDisplayProps {
    img: string;
    name: string;
    id: string;
}

export function CardImageDisplay({ img, name, id }: CardImageDisplayProps) {
    const [isLoaded, setIsLoaded] = useState(false);

    return (
        <div className='relative aspect-[2.5/3.5] w-full overflow-hidden rounded-xl bg-muted shadow-lg'>
            {/* 
                Matches the grid exactly: sizes="192px".
                This loads images instantly from disk cache.
            */}
            <Image
                src={img}
                alt={name}
                fill
                sizes='192px'
                className='object-cover'
                aria-hidden='true'
                style={{
                    viewTransitionName: `card-image-${id}`,
                    viewTransitionClass: 'card-expand'
                }}
            />

            {/* 
                High-res image overlaps low-res variant once loaded.
            */}
            <Image
                src={img}
                alt={name}
                fill
                priority={true}
                sizes='(max-width: 768px) 100vw, 33vw'
                className={`z-10 object-cover transition-opacity duration-500 ${
                    isLoaded ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => setIsLoaded(true)}
            />
        </div>
    );
}
