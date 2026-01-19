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

    // Handle full URLs vs Relative paths safely
    let cleanPath = src;

    // If someone passes a full URL (e.g. https://example.com/cards/1.png), extract just the path
    if (src.startsWith('http')) {
        try {
            cleanPath = new URL(src).pathname;
        } catch (e) {
            // Fallback to original string if URL parsing fails
            cleanPath = src;
        }
    }

    // Remove leading slash so we don't get double slashes later
    if (cleanPath.startsWith('/')) {
        cleanPath = cleanPath.slice(1);
    }

    // Strip the extension (eg .png, .jpg)
    // This turns "cards/xy1-1.png" into "cards/xy1-1"
    const pathWithoutExtension = cleanPath.replace(/\.[^/.]+$/, '');

    // Construct the final optimized URL
    // Result: https://assets.cardledger.io/optimized/cards/xy1-1/640.avif
    return `https://assets.cardledger.io/optimized/${pathWithoutExtension}/${targetSize}.avif`;
}
