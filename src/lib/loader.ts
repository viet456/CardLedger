'use client';

export default function r2ImageLoader({
    src,
    width,
    quality
}: {
    src: string;
    width: number;
    quality?: number;
}) {
    const allSizes = [64, 384, 512, 640];
    const targetSize = allSizes.find((size) => size >= width) || 640;
    const url = new URL(src);
    const cleanSrc = url.pathname.slice(1);
    const pathWithoutExtension = cleanSrc.replace(/\.[^/.]+$/, '');
    return `https://assets.cardledger.io/optimized/${pathWithoutExtension}/${targetSize}.avif`;
}
