'use client';

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';

const FALLBACK_IMAGE = '/images/card-placeholder.avif';

interface ResilientImageProps extends Omit<ImageProps, 'src'> {
    src: string | null | undefined;
}

export function ResilientImage({ src, alt, ...props }: ResilientImageProps) {
    const initialSrc = src || FALLBACK_IMAGE;
    const [imgSrc, setImgSrc] = useState(initialSrc);
    const [isError, setIsError] = useState(!src);

    return (
        <Image
            {...props}
            src={imgSrc}
            alt={alt}
            loader={isError ? undefined : props.loader}
            onError={() => {
                if (!isError) {
                    setImgSrc(FALLBACK_IMAGE);
                    setIsError(true);
                }
            }}
            unoptimized={isError || props.unoptimized}
        />
    );
}
