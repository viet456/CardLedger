import { describe, it, expect } from 'vitest';
import { chooseKeeper, type KeeperSignals } from '../duplicateDetection';

const sig = (over: Partial<KeeperSignals> & { id: string }): KeeperSignals => ({
    number: '1',
    isLive: false,
    isNative: true,
    hasImage: false,
    hasPrice: false,
    setTotal: 100,
    ...over
});

describe('chooseKeeper', () => {
    it('favours the id that is live in the TCGdex set listing (API keeper)', () => {
        const { winner, via } = chooseKeeper([
            sig({ id: '2011bw-12', hasImage: true, hasPrice: true }),
            sig({ id: 'mcd11-12', isLive: true })
        ]);
        expect(winner.id).toBe('mcd11-12');
        expect(via).toBe('api');
    });

    it('prefers the API zero-padded localId form on zero-notation collisions', () => {
        // "sv04.5-033" is the live form; the short form exists only as a legacy row
        const { winner, via } = chooseKeeper([
            sig({ id: 'sv04.5-33', number: '33', hasImage: true }),
            sig({ id: 'sv04.5-033', number: '033', isLive: true })
        ]);
        expect(winner.id).toBe('sv04.5-033');
        expect(via).toBe('api');
    });

    it('falls back to the zero-padded number form when liveness is unavailable', () => {
        const { winner, via } = chooseKeeper([
            sig({ id: 'mcd11-12', number: '12' }),
            sig({ id: 'mcd11-012', number: '012' })
        ]);
        expect(winner.id).toBe('mcd11-012');
        expect(via).toBe('localId');
    });

    it('prefers native ids over migration leftovers when liveness ties', () => {
        const { winner } = chooseKeeper([
            sig({ id: '2011bw-12', isNative: false, hasImage: true }),
            sig({ id: 'mcd11-12', isNative: true })
        ]);
        expect(winner.id).toBe('mcd11-12');
    });

    it('prefers a card with an image, then price data, then the larger set', () => {
        expect(chooseKeeper([sig({ id: 'a', hasImage: true }), sig({ id: 'b' })]).winner.id).toBe('a');
        expect(chooseKeeper([sig({ id: 'a', hasPrice: true }), sig({ id: 'b' })]).winner.id).toBe('a');
        expect(
            chooseKeeper([sig({ id: 'a', setTotal: 200 }), sig({ id: 'b', setTotal: 70 })]).winner.id
        ).toBe('a');
    });

    it('breaks full ties deterministically by id with a heuristic rationale', () => {
        const { winner, via, rationale } = chooseKeeper([sig({ id: 'b' }), sig({ id: 'a' })]);
        expect(winner.id).toBe('a');
        expect(via).toBe('heuristic');
        expect(rationale).toContain('deterministic');
    });
});
