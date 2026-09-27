import { describe, expect, it } from 'vitest';
import {
    cardIdRedirects,
    cardRedirects,
    setRedirects,
    type LegacyRedirect
} from '../cardRedirects';

/**
 * Offline invariants for the legacy redirect graph. The pairs are permanent
 * and append-only (see the cardRedirects.ts header): they drive both the 301s
 * in next.config.ts and collectionStore's client-side card id remap, so a
 * structural regression here breaks old URLs and offline collections
 * silently. Id provenance against TCGdex is not checked here (needs network).
 */
describe('legacy redirect graph', () => {
    const all: LegacyRedirect[] = [...cardRedirects, ...setRedirects];
    const kind = (p: string) => p.split('/')[1];

    it('has unique sources and no self-loops', () => {
        const sources = all.map((r) => r.source);
        expect(new Set(sources).size).toBe(sources.length);
        for (const r of all) expect(r.source).not.toBe(r.destination);
    });

    it('is chain-free: no destination is another pair source', () => {
        const sources = new Set(all.map((r) => r.source));
        for (const r of all) expect(sources.has(r.destination)).toBe(false);
    });

    it('keeps pairs same-type (cards to cards, sets to sets)', () => {
        for (const r of all) {
            expect(kind(r.source)).toBe(kind(r.destination));
            expect(['cards', 'sets']).toContain(kind(r.source));
        }
    });

    it('has URL-safe paths', () => {
        for (const r of all) {
            for (const p of [r.source, r.destination]) {
                expect(p.split('/').length).toBe(3); // /cards/<id> exactly
                expect(p).not.toMatch(/[?#\s]/);
                expect(() => decodeURIComponent(p)).not.toThrow();
            }
        }
    });

    it('derives cardIdRedirects as decoded id pairs', () => {
        const entries = Object.entries(cardIdRedirects);
        expect(entries.length).toBe(cardRedirects.length);
        for (const r of cardRedirects) {
            const from = decodeURIComponent(r.source.slice('/cards/'.length));
            const to = decodeURIComponent(r.destination.slice('/cards/'.length));
            expect(from).not.toBe(to);
            expect(cardIdRedirects[from]).toBe(to);
        }
    });
});
