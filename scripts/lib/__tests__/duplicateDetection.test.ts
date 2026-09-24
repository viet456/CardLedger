import { describe, it, expect } from 'vitest';
import {
    chooseKeeper,
    chooseSetKeeper,
    findSignatureOnlyPairs,
    groupDuplicateSets,
    matchByNameBijection,
    normalizeCardName,
    setIdForCard,
    type KeeperSignals,
    type MiniCard,
    type SetMergeCandidate
} from '../duplicateDetection';

const mc = (id: string, name: string, number: string, setId = 'x'): MiniCard => ({ id, name, number, setId, rarity: 'Rare Holo' });

const sig = (over: Partial<KeeperSignals> & { id: string }): KeeperSignals => ({
    number: '1',
    isLive: false,
    isNative: true,
    hasImage: false,
    hasPrice: false,
    setTotal: 100,
    ...over
});

describe('chooseSetKeeper', () => {
    it('favours the live id over an image-rich dead shell', () => {
        const { winner, via } = chooseSetKeeper([
            { id: 'cel25c', isLive: false, hasLogo: true, hasSymbol: true, cardsWithImages: 25, cardCount: 25, total: 25 },
            { id: 'cel25cc', isLive: true, hasLogo: false, hasSymbol: false, cardsWithImages: 0, cardCount: 25, total: 25 }
        ]);
        expect(winner.id).toBe('cel25cc');
        expect(via).toBe('api');
    });

    it('prefers the asset-rich set when liveness ties', () => {
        const { winner, via } = chooseSetKeeper([
            { id: 'swsh12pt5gg', isLive: false, hasLogo: true, hasSymbol: true, cardsWithImages: 0, cardCount: 0, total: 70 },
            { id: 'swsh12.5gg', isLive: false, hasLogo: false, hasSymbol: false, cardsWithImages: 70, cardCount: 70, total: 70 }
        ]);
        expect(winner.id).toBe('swsh12pt5gg');
        expect(via).toBe('heuristic');
    });

    it('falls back to cards, then deterministic id asc', () => {
        const { winner, rationale } = chooseSetKeeper([
            { id: 'b', isLive: false, hasLogo: false, hasSymbol: false, cardsWithImages: 5, cardCount: 5, total: 5 },
            { id: 'a', isLive: false, hasLogo: false, hasSymbol: false, cardsWithImages: 5, cardCount: 5, total: 5 }
        ]);
        expect(winner.id).toBe('a');
        expect(rationale).toContain('deterministic');
    });
});

describe('groupDuplicateSets', () => {
    it('groups name twins and keeps the live member (cel25c -> cel25cc shape)', () => {
        const groups = groupDuplicateSets([
            sc({
                id: 'cel25c',
                name: 'Celebrations: Classic Collection',
                cardsWithImages: 25,
                hasLogo: true,
                hasSymbol: true,
                cards: [mc('cel25c-2_A', 'Blastoise', '2_A'), mc('cel25c-54_A', 'Mewtwo-EX', '54_A')]
            }),
            sc({
                id: 'cel25cc',
                name: 'Celebrations Classic Collection',
                isLive: true,
                cards: [mc('cel25cc-CC001', 'Blastoise', 'CC001'), mc('cel25cc-CC022', 'Mewtwo EX', 'CC022')]
            })
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0].reason).toBe('name');
        expect(groups[0].keeper!.winner.id).toBe('cel25cc');
        expect(groups[0].blocked).toBeNull();
    });

    it('groups a dead empty shell via card redirects (fut20 -> fut2020 shape)', () => {
        const groups = groupDuplicateSets(
            [
                sc({ id: 'fut20', name: 'Pokémon Futsal Collection' }),
                sc({ id: 'fut2020', name: 'Pokémon Futsal 2020', isLive: true, hasLogo: true, hasSymbol: true })
            ],
            [{ source: '/cards/fut20-1', destination: '/cards/fut2020-1' }]
        );
        expect(groups).toHaveLength(1);
        expect(groups[0].reason).toBe('redirects');
        expect(groups[0].keeper!.winner.id).toBe('fut2020');
        expect(groups[0].blocked).toBeNull();
    });

    it('blocks groups where both members are live in TCGdex', () => {
        const groups = groupDuplicateSets([
            sc({ id: 'a', name: 'Same Thing', isLive: true }),
            sc({ id: 'b', name: 'Same Thing', isLive: true })
        ]);
        expect(groups[0].blocked).toContain('multiple members live');
    });

    it('ignores card-level redirect trivia between sets that still hold cards', () => {
        // ex10/exu reality: card-level Unown merges leave redirects behind, but
        // both sets keep their own listings — NOT set-level duplicates.
        const groups = groupDuplicateSets(
            [
                sc({
                    id: 'ex10',
                    name: 'Unseen Forces',
                    printedTotal: 115,
                    total: 115,
                    releaseDate: new Date('2006-02-01'),
                    cards: [mc('ex10-!', 'Unown !', '!'), mc('ex10-115', 'Ho-Oh', '115')]
                }),
                sc({
                    id: 'exu',
                    name: 'Unseen Forces Unown Collection',
                    isLive: true,
                    printedTotal: 28,
                    total: 28,
                    releaseDate: new Date('2006-05-01'),
                    cards: [mc('exu-1', 'Unown A', '1')]
                })
            ],
            [{ source: '/cards/ex10-!', destination: '/cards/exu-!' }]
        );
        expect(groups).toEqual([]);
    });

    it('ignores a dead shell whose redirects scatter across sets', () => {
        const groups = groupDuplicateSets(
            [
                sc({ id: 'fut20', name: 'Futsal Promo' }),
                sc({ id: 'fut2020', name: 'Futsal 2020', isLive: true }),
                sc({ id: 'fut20b', name: 'Futsal Other', isLive: true })
            ],
            [
                { source: '/cards/fut20-1', destination: '/cards/fut2020-1' },
                { source: '/cards/fut20-2', destination: '/cards/fut20b-1' }
            ]
        );
        expect(groups).toEqual([]);
    });

    it('blocks a name-twin loser still holding differently-named cards', () => {
        const groups = groupDuplicateSets([
            sc({ id: 'a1', name: 'Same Product', isLive: true, cards: [mc('a1-1', 'Pikachu', '1')] }),
            sc({ id: 'b2', name: 'Same Product!', cards: [mc('b2-1', 'Charizard', '1')] })
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0].keeper!.winner.id).toBe('a1');
        expect(groups[0].blocked).toContain('b2');
    });

    it('keeps distinct same-signature sets apart (trainer kits)', () => {
        expect(
            groupDuplicateSets([
                sc({ id: 'tk-xy-su-20', name: 'Zapdos Coin Collection' }),
                sc({ id: 'tk-xy-latia-20', name: 'Latias Coin Collection' })
            ])
        ).toEqual([]);
    });
});

describe('findSignatureOnlyPairs', () => {
    it('reports name-differing print-signature twins only', () => {
        const twins = findSignatureOnlyPairs([
            sc({ id: 'tk-xy-su-20', name: 'Zapdos Coin Collection', printedTotal: 40, total: 40, releaseDate: new Date('2014-11-05') }),
            sc({ id: 'tk-xy-latia-20', name: 'Latias Coin Collection', printedTotal: 40, total: 40, releaseDate: new Date('2014-11-05') }),
            sc({ id: 'cel25c', name: 'Celebrations: Classic Collection' }),
            sc({ id: 'cel25cc', name: 'Celebrations Classic Collection' }),
            sc({ id: 'sv04', name: 'Paradox Rift', printedTotal: 182, total: 266, releaseDate: new Date('2023-11-03') })
        ]);
        expect(twins.map(([a, b]) => `${a.id}/${b.id}`)).toEqual(['tk-xy-su-20/tk-xy-latia-20']);
    });
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

const sc = (over: Partial<SetMergeCandidate> & { id: string; name: string }): SetMergeCandidate => ({
    releaseDate: new Date('2021-10-08'),
    printedTotal: 25,
    total: 25,
    isLive: false,
    cards: [],
    cardsWithImages: 0,
    hasLogo: false,
    hasSymbol: false,
    ...over
});

describe('normalizeCardName', () => {
    it('equates hyphen/space EX/GX forms', () => {
        expect(normalizeCardName('Mewtwo-EX')).toBe(normalizeCardName('Mewtwo EX'));
        expect(normalizeCardName('Tapu Lele-GX')).toBe(normalizeCardName('Tapu Lele GX'));
    });

    it('strips delta/star markers and punctuation', () => {
        expect(normalizeCardName('Gardevoir ex δ')).toBe(normalizeCardName('Gardevoir ex'));
        expect(normalizeCardName('Umbreon ☆')).toBe('umbreon');
    });

    it('keeps genuinely distinct names apart', () => {
        expect(normalizeCardName('Pikachu ex')).not.toBe(normalizeCardName('Pikachu'));
    });
});

describe('matchByNameBijection', () => {
    it('pairs checklists despite different printed numbers', () => {
        const { pairs, unmatchedAs, unmatchedBs } = matchByNameBijection(
            [mc('cel25c-2_A', 'Blastoise', '2_A'), mc('cel25c-54_A', 'Mewtwo-EX', '54_A'), mc('cel25c-93_A', 'Gardevoir ex δ', '93_A')],
            [mc('cel25cc-CC022', 'Mewtwo EX', 'CC022'), mc('cel25cc-CC001', 'Blastoise', 'CC001'), mc('cel25cc-CC014', 'Gardevoir ex', 'CC014')]
        );
        expect(pairs.map(([a, b]) => `${a.id}->${b.id}`).sort()).toEqual([
            'cel25c-2_A->cel25cc-CC001',
            'cel25c-54_A->cel25cc-CC022',
            'cel25c-93_A->cel25cc-CC014'
        ]);
        expect(unmatchedAs).toEqual([]);
        expect(unmatchedBs).toEqual([]);
    });

    it('never guesses ambiguous same-name rows', () => {
        const { pairs, unmatchedAs, unmatchedBs } = matchByNameBijection(
            [mc('a1', 'Rayquaza VMAX', '1'), mc('a2', 'Rayquaza VMAX', '2')],
            [mc('b1', 'Rayquaza VMAX', '1'), mc('b2', 'Rayquaza VMAX', '2')]
        );
        expect(pairs).toEqual([]);
        expect(unmatchedAs).toHaveLength(2);
        expect(unmatchedBs).toHaveLength(2);
    });

    it('pairs leftovers only via unique containment', () => {
        const { pairs, unmatchedAs, unmatchedBs } = matchByNameBijection(
            [mc('a1', 'Pikachu (Male)', '1'), mc('a2', 'Eevee', '2')],
            [mc('b1', 'Pikachu', '1'), mc('b2', 'Eevee', '2')]
        );
        expect(pairs.map(([a, b]) => `${a.id}->${b.id}`).sort()).toEqual(['a1->b1', 'a2->b2']);
        expect(unmatchedAs).toEqual([]);
        expect(unmatchedBs).toEqual([]);
    });

    it('returns one-sided names as unmatched', () => {
        const { pairs, unmatchedAs } = matchByNameBijection([mc('a1', 'Sobble', '1')], [mc('b1', 'Grookey', '1')]);
        expect(pairs).toEqual([]);
        expect(unmatchedAs).toHaveLength(1);
    });
});

describe('setIdForCard', () => {
    it('resolves the longest set-id prefix (dash-containing set ids)', () => {
        expect(setIdForCard('tk-ex-p-9', ['tk-ex-p', 'tk'])).toBe('tk-ex-p');
        expect(setIdForCard('fut20-1', ['fut20', 'fut2020'])).toBe('fut20');
        expect(setIdForCard('unknown-1', ['fut20'])).toBeNull();
    });
});
