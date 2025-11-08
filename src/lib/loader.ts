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
    const allSizes = [16, 32, 48, 64, 96, 192, 384, 640, 750, 828, 1080];
    const targetSize = allSizes.find((size) => size >= width) || allSizes[allSizes.length - 1];
    const url = new URL(src);
    const cleanSrc = url.pathname.slice(1);
    const pathWithoutExtension = cleanSrc.replace(/\.[^/.]+$/, '');
    return `https://assets.cardledger.io/optimized/${pathWithoutExtension}/${targetSize}.avif`;
}
