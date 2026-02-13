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

    // Only strips actual image extensions
    // This allows IDs like "me02.5-001" to pass through unharmed
    const pathWithoutExtension = cleanPath.replace(/\.(png|jpg|jpeg|webp|avif|gif)$/i, '');

    // Construct the final optimized URL
    // Result: https://assets.cardledger.io/optimized/cards/xy1-1/640.avif
    return `https://assets.cardledger.io/optimized/${pathWithoutExtension}/${targetSize}.avif`;
}
