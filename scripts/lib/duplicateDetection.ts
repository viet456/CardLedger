/**
 * Shared duplicate-detection heuristics for the dedupe pipeline.
 *
 * Used by:
 *   - scripts/auditDuplicates.ts  (read-only report for human review)
 *   - scripts/populate.ts         (guard against re-creating duplicates)
 *
 * Duplicate classes (full report in scripts/auditDuplicates.ts):
 *   Class 1a — same set, same name, same NORMALIZED number ("086" vs "86"):
 *              merge into one card + 301 the loser.
 *   Class 1b — same name + number across TCGdex "shadow sets" (the same
 *              physical product re-issued under a new set id, e.g.
 *              /cards/2011bw-12 == /cards/mcd11-12): merge + 301.
 *   Class 2  — same set, same name, different numbers, one carrying a
 *              "No Logo" / "No Symbol" rarity: distinct printings — keep both
 *              live but canonicalize the variant to the main printing and
 *              exclude it from sitemaps. Detection lives in the audit script.
 */

export interface MiniCard {
    id: string;
    name: string;
    number: string;
    setId: string;
    /** Rarity name (null/undefined/"None" = the "No Logo" class) */
    rarity?: string | null;
}

/**
 * Rarity classes: 'None'/null is the "No Logo" class. Two cards sharing a key
 * across DIFFERENT classes may be distinct variant printings (stamped vs
 * unstamped) and must NOT be merged blindly.
 */
export type RarityClass = 'noneish' | 'real';

export function rarityClass(name?: string | null): RarityClass {
    return !name || name === 'None' ? 'noneish' : 'real';
}

/** Ids created natively for their set ("{setId}-{number}...") vs leftovers. */
export function isNativeId(card: MiniCard): boolean {
    return card.id.startsWith(`${card.setId}-`);
}

export interface MiniSet {
    id: string;
    name: string;
    releaseDate: Date;
    printedTotal: number;
    total: number;
}

/** "086" == "86" — zero-notation normalization (Class 1a). */
export function normalizeNumber(number: string): string {
    return number.trim().toLowerCase().replace(/^0+(?=\d)/, '');
}

/** Exact physical-card key (Class 1b matching). */
export function nameNumberKey(name: string, number: string): string {
    return `${name.trim().toLowerCase()}\u0000${number.trim().toLowerCase()}`;
}

/** Zero-notation-tolerant key scoped to one set (Class 1a matching). */
export function setNormNumberKey(setId: string, name: string, number: string): string {
    return `${setId}\u0000${name.trim().toLowerCase()}\u0000${normalizeNumber(number)}`;
}

/** "Macdonald's Collection 2011" ~ "McDonalds Collection 2011" */
export function normalizeSetName(name: string): string {
    return name
        .toLowerCase()
        .replace(/macdonald/g, 'mcdonald')
        .replace(/[^a-z0-9]/g, '');
}

/** Loose "same product" signature used as a shadow-set fallback signal. */
export function sameShadowSignature(a: MiniSet, b: MiniSet): boolean {
    if (normalizeSetName(a.name) === normalizeSetName(b.name)) return true;
    return (
        a.releaseDate.getTime() === b.releaseDate.getTime() &&
        a.printedTotal === b.printedTotal &&
        a.total === b.total
    );
}

/**
 * Null-safe "same product" print signature — release date + printed/total
 * counts only (names excluded). Flag-only basis for `findSignatureOnlyPairs`;
 * never auto-merges. Set-level twins are grouped by `groupDuplicateSets`.
 */
function samePrintSignature(
    a: { releaseDate: Date | null; printedTotal: number; total: number },
    b: { releaseDate: Date | null; printedTotal: number; total: number }
): boolean {
    return (
        a.releaseDate?.toISOString().slice(0, 10) === b.releaseDate?.toISOString().slice(0, 10) &&
        a.printedTotal === b.printedTotal &&
        a.total === b.total
    );
}

/**
 * Normalize a card name to a comparison key for set-level bijection matching —
 * the same product listed twice under one shell with different numbering, e.g.
 * cel25c-2_A vs cel25cc-CC001 "Blastoise". NFKD + strip marks; fold the
 * hyphen/space EX/GX forms ("Mewtwo-EX" vs "Mewtwo EX"); strip ☆/δ/★ class
 * markers and punctuation. Never splits words apart, so genuinely distinct
 * names ("Pikachu ex" vs "Pikachu") stay distinct.
 */
export function normalizeCardName(name: string): string {
    return name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[\u2606\u2605\u2726\u03b4]/gu, ' ') // ☆ ★ ✦ δ class markers
        .replace(/([a-z0-9])[\s\-]*(ex|gx|lvx|legend)$/u, '$1 $2')
        .replace(/[^a-z0-9]+/g, '');
}

/** Name-pairing result between two card lists (set-level merge checks). */
export interface NameBijection {
    /** Paired rows in `as` iteration order. */
    pairs: Array<[MiniCard, MiniCard]>;
    unmatchedAs: MiniCard[];
    unmatchedBs: MiniCard[];
}

/**
 * Pair two card lists by normalized name — ONLY unambiguous matches (1:1 name
 * groups, plus unique mutual-containment leftovers like "Pikachu (Male)" ↔
 * "Pikachu"). Never guesses between multiple same-name rows. One-sided names
 * come back unmatched for manual review (e.g. the swsh12tg Mismagius quirk).
 */
export function matchByNameBijection(as: MiniCard[], bs: MiniCard[]): NameBijection {
    const groupByKey = (rows: MiniCard[]): Map<string, MiniCard[]> => {
        const grouped = new Map<string, MiniCard[]>();
        for (const row of rows) {
            const key = normalizeCardName(row.name);
            grouped.set(key, [...(grouped.get(key) ?? []), row]);
        }
        return grouped;
    };
    const aByKey = groupByKey(as);
    const bByKey = groupByKey(bs);

    const pairs: Array<[MiniCard, MiniCard]> = [];
    const pairedAs = new Set<string>();
    const pairedBs = new Set<string>();

    // Pass 1 — exact normalized-name groups, only when strictly 1:1.
    for (const [key, groupA] of aByKey) {
        const groupB = bByKey.get(key);
        if (groupA.length === 1 && groupB?.length === 1) {
            pairs.push([groupA[0], groupB[0]]);
            pairedAs.add(groupA[0].id);
            pairedBs.add(groupB[0].id);
        }
    }

    // Pass 2 — leftovers, only on unique mutual containment ("pikachumale" ⊃
    // "pikachu"), still refusing anything ambiguous.
    for (const a of as) {
        if (pairedAs.has(a.id)) continue;
        const ka = normalizeCardName(a.name);
        const contains = (b: MiniCard): boolean => {
            const kb = normalizeCardName(b.name);
            return ka.includes(kb) || kb.includes(ka);
        };
        const candidates = bs.filter((b) => !pairedBs.has(b.id) && contains(b));
        if (candidates.length !== 1) continue;
        // No other unpaired `a` may also containment-match this b.
        const counter = as.filter((x) => {
            if (x.id === a.id || pairedAs.has(x.id)) return false;
            const kx = normalizeCardName(x.name);
            const kb = normalizeCardName(candidates[0].name);
            return kx.includes(kb) || kb.includes(kx);
        });
        if (counter.length > 0) continue;
        pairs.push([a, candidates[0]]);
        pairedAs.add(a.id);
        pairedBs.add(candidates[0].id);
    }

    return {
        pairs,
        unmatchedAs: as.filter((a) => !pairedAs.has(a.id)),
        unmatchedBs: bs.filter((b) => !pairedBs.has(b.id))
    };
}

// ---------------------------------------------------------------------------
// SET-LEVEL CONSOLIDATION — duplicate set shells: the same physical product
// living under a dead API id AND its live TCGdex id (e.g. swsh12pt5gg vs
// swsh12.5gg). TCGdex is the source of truth for set identity; R2 is the
// source of truth for set logo/symbol images (the API often lacks subset
// logos, so a "loser" shell may hold the only image). Used by
// scripts/auditSetMerges.ts and scripts/applySetMerges.ts.
// ---------------------------------------------------------------------------

/** Signals a set offers to `chooseSetKeeper` (set-merge audit/apply scripts). */
export interface SetKeeperSignals {
    id: string;
    /** Id is live in the TCGdex /en/sets listing — the API-canonical form. */
    isLive: boolean;
    hasLogo: boolean;
    hasSymbol: boolean;
    /** Attached card rows carrying an imageKey. */
    cardsWithImages: number;
    /** Attached card rows. */
    cardCount: number;
    /** DB `total` of the set — fuller listings win ties. */
    total: number;
}

export interface SetKeeperChoice {
    winner: SetKeeperSignals;
    /** Which rule family decided: the live API or local heuristics. */
    via: 'api' | 'heuristic';
    rationale: string;
}

/**
 * Pick the surviving set for a duplicate-set group — the row that keeps its
 * URL and absorbs the other's cards/assets. Ranking:
 *   1. TCGdex liveness — TCGdex is the source of truth for set identity.
 *   2. More set images (logo + symbol) — R2 is the source of truth for
 *      images, so a shell holding the only logo wins this factor.
 *   3. More cards carrying images.
 *   4. More cards attached.
 *   5. Fuller listing (`total`).
 *   6. Deterministic id asc.
 * Always a PROPOSAL — humans approve via `pnpm db:apply-set-merges`
 * (dry-run first).
 */
export function chooseSetKeeper(signals: SetKeeperSignals[]): SetKeeperChoice {
    const images = (s: SetKeeperSignals) => Number(s.hasLogo) + Number(s.hasSymbol);
    const sorted = [...signals].sort((a, b) => {
        if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
        if (images(a) !== images(b)) return images(b) - images(a);
        if (a.cardsWithImages !== b.cardsWithImages) return b.cardsWithImages - a.cardsWithImages;
        if (a.cardCount !== b.cardCount) return b.cardCount - a.cardCount;
        if (a.total !== b.total) return b.total - a.total;
        return a.id < b.id ? -1 : 1;
    });
    const winner = sorted[0];
    const others = signals.filter((s) => s.id !== winner.id);

    // Only report the factors that actually separate the winner from a loser.
    const factors: string[] = [];
    if (winner.isLive && others.some((o) => !o.isLive)) factors.push('id in live TCGdex set listing');
    if (others.some((o) => images(o) < images(winner))) factors.push('more set images (logo/symbol in R2)');
    if (others.some((o) => o.cardsWithImages < winner.cardsWithImages)) factors.push('more cards with images');
    if (others.some((o) => o.cardCount < winner.cardCount)) factors.push(`more cards (${winner.cardCount})`);
    if (others.some((o) => o.total < winner.total)) factors.push(`fuller listing (${winner.total} cards)`);
    if (factors.length === 0) factors.push('deterministic (id asc)');

    const via: SetKeeperChoice['via'] = factors[0].includes('live TCGdex') ? 'api' : 'heuristic';
    const label = via === 'api' ? 'via TCGdex API' : 'local heuristics';
    return { winner, via, rationale: `${label}: ${factors.join(', ')}; verify manually` };
}

/**
 * Flag-only: pairs sharing the same print signature (release date + printed/
 * total counts) with DIFFERENT names — the candidate-corruption tail (tk-xy-su
 * 20 vs tk-xy-latia 20). Never auto-merges; feeds `pnpm db:lint-cards`.
 */
export function findSignatureOnlyPairs(sets: SetMergeCandidate[]): Array<[SetMergeCandidate, SetMergeCandidate]> {
    const pairs: Array<[SetMergeCandidate, SetMergeCandidate]> = [];
    for (let i = 0; i < sets.length; i++) {
        for (let j = i + 1; j < sets.length; j++) {
            const a = sets[i];
            const b = sets[j];
            if (normalizeSetName(a.name) === normalizeSetName(b.name)) continue; // grouping handles twins
            if (samePrintSignature(a, b)) pairs.push([a, b]);
        }
    }
    return pairs;
}

function pairKey(setIdA: string, setIdB: string): string {
    return setIdA < setIdB ? `${setIdA}\u0000${setIdB}` : `${setIdB}\u0000${setIdA}`;
}

// Shadow-set detection thresholds: two sets are considered the same product
// when they share at least MIN_SHARED physical cards AND at least OVERLAP_PCT
// of the smaller set. Tunable after the first audit review.
const MIN_SHARED = 3;
const OVERLAP_PCT = 0.4;

export class DuplicateIndex {
    /** name|number -> cards (all sets) */
    byNameNumber = new Map<string, MiniCard[]>();
    /** set|name|normalizedNumber -> cards (one set) */
    bySetNormNumber = new Map<string, MiniCard[]>();
    sets = new Map<string, MiniSet>();
    /** setId pairs ("a\u0000b", a < b) that look like shadow sets */
    shadowPairs = new Set<string>();

    constructor(cards: MiniCard[], sets: MiniSet[]) {
        for (const set of sets) this.sets.set(set.id, set);
        for (const card of cards) {
            const exact = nameNumberKey(card.name, card.number);
            const list = this.byNameNumber.get(exact) ?? [];
            list.push(card);
            this.byNameNumber.set(exact, list);

            const loose = setNormNumberKey(card.setId, card.name, card.number);
            const looseList = this.bySetNormNumber.get(loose) ?? [];
            looseList.push(card);
            this.bySetNormNumber.set(loose, looseList);
        }
        this.detectShadowPairs();
    }

    private detectShadowPairs() {
        const overlap = new Map<string, number>();
        const sizes = new Map<string, number>();
        for (const [, cards] of this.byNameNumber) {
            for (const card of cards) {
                sizes.set(card.setId, (sizes.get(card.setId) ?? 0) + 1);
            }
            const setIds = [...new Set(cards.map((c) => c.setId))];
            for (let i = 0; i < setIds.length; i++) {
                for (let j = i + 1; j < setIds.length; j++) {
                    const key = pairKey(setIds[i], setIds[j]);
                    overlap.set(key, (overlap.get(key) ?? 0) + 1);
                }
            }
        }
        for (const [key, shared] of overlap) {
            const [a, b] = key.split('\u0000');
            const minSize = Math.min(sizes.get(a) ?? Infinity, sizes.get(b) ?? Infinity);
            if (shared >= MIN_SHARED && shared >= OVERLAP_PCT * minSize) {
                this.shadowPairs.add(key);
            }
        }
    }

    areShadows(setIdA: string, setIdB: string): boolean {
        if (setIdA === setIdB) return false;
        if (this.shadowPairs.has(pairKey(setIdA, setIdB))) return true;
        const a = this.sets.get(setIdA);
        const b = this.sets.get(setIdB);
        return !!a && !!b && sameShadowSignature(a, b);
    }

    /**
     * Returns an existing card equivalent to the candidate under a DIFFERENT
     * id (Class 1a or 1b), or null when the candidate is safe to create.
     * Never matches across rarity classes (variant printings are distinct).
     */
    findDuplicate(candidate: MiniCard): MiniCard | null {
        const sameClass = (existing: MiniCard) =>
            rarityClass(existing.rarity) === rarityClass(candidate.rarity);

        // Class 1a: same set, same name, zero-notation number collision
        const loose = this.bySetNormNumber.get(
            setNormNumberKey(candidate.setId, candidate.name, candidate.number)
        );
        for (const existing of loose ?? []) {
            if (existing.id !== candidate.id && sameClass(existing)) return existing;
        }

        // Class 1b: same physical card in a shadow set
        const exact = this.byNameNumber.get(nameNumberKey(candidate.name, candidate.number));
        for (const existing of exact ?? []) {
            if (existing.id === candidate.id) continue;
            if (this.areShadows(candidate.setId, existing.setId)) return existing;
        }
        return null;
    }
}


/** Signals a keeper candidate offers to `chooseKeeper` (dedupe audit/apply scripts). */
export interface KeeperSignals {
    id: string;
    /** Printed number — used to prefer zero-padded ("033") over short ("33") forms. */
    number: string;
    /** Id appears in the live TCGdex set listing — the API-canonical form. */
    isLive: boolean;
    /** Id follows the native "{setId}-…" convention (vs a migration leftover). */
    isNative: boolean;
    hasImage: boolean;
    hasPrice: boolean;
    /** DB `total` of the candidate's set — fuller listings win ties. */
    setTotal: number;
}

export interface KeeperChoice {
    winner: KeeperSignals;
    /** Which rule family decided: the live API, its localId convention, or local heuristics. */
    via: 'api' | 'localId' | 'heuristic';
    rationale: string;
}

/**
 * Pick the keeper for a merge group — the row that survives and absorbs the
 * others. Ranking (pipeline context in scripts/auditDuplicates.ts):
 *   1. TCGdex liveness — the API keeps updating, so its canonical id wins.
 *      For zero-notation collisions ("033"/"33") the API's zero-padded
 *      `localId` form is the live one and wins here.
 *   2. Zero-padded number form (API `localId` convention) on liveness ties.
 *   3. Native "{setId}-…" id (migration leftovers go away).
 *   4. Has an image (can absorb the other's later).
 *   5. Has price data (links/SEO value).
 *   6. Larger (fuller) set listing.
 *   7. Deterministic id asc.
 * Always a PROPOSAL — humans approve via `pnpm db:apply-merges` (dry-run first).
 */
export function chooseKeeper(signals: KeeperSignals[]): KeeperChoice {
    const digits = (s: KeeperSignals) => s.number.replace(/\D/g, '').length;
    const sorted = [...signals].sort((a, b) => {
        if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
        if (digits(a) !== digits(b)) return digits(b) - digits(a);
        if (a.isNative !== b.isNative) return a.isNative ? -1 : 1;
        if (a.hasImage !== b.hasImage) return a.hasImage ? -1 : 1;
        if (a.hasPrice !== b.hasPrice) return a.hasPrice ? -1 : 1;
        if (a.setTotal !== b.setTotal) return b.setTotal - a.setTotal;
        return a.id < b.id ? -1 : 1;
    });
    const winner = sorted[0];
    const others = signals.filter((s) => s.id !== winner.id);

    // Only report the factors that actually separate the winner from a loser.
    const factors: string[] = [];
    if (winner.isLive && others.some((o) => !o.isLive)) factors.push('id in live TCGdex set listing');
    if (others.some((o) => digits(o) < digits(winner))) {
        factors.push('zero-padded number (API localId convention)');
    }
    if (winner.isNative && others.some((o) => !o.isNative)) factors.push('native id');
    if (winner.hasImage && others.some((o) => !o.hasImage)) factors.push('has image');
    if (winner.hasPrice && others.some((o) => !o.hasPrice)) factors.push('has price data');
    if (others.some((o) => o.setTotal < winner.setTotal)) {
        factors.push(`larger set listing (${winner.setTotal} cards)`);
    }
    if (factors.length === 0) factors.push('deterministic (id asc)');

    const via: KeeperChoice['via'] = factors[0].includes('live TCGdex')
        ? 'api'
        : factors[0].includes('zero-padded')
          ? 'localId'
          : 'heuristic';
    const label =
        via === 'api' ? 'via TCGdex API' : via === 'localId' ? 'via API localId convention' : 'local heuristics';
    return { winner, via, rationale: `${label}: ${factors.join(', ')}; verify manually` };
}

// ---------------------------------------------------------------------------
// SET-LEVEL GROUPING (set-merge audit/apply scripts). Survivor rules:
// `SetKeeperSignals` / `chooseSetKeeper` above.
// ---------------------------------------------------------------------------

/** Read-model of a `Set` row plus the children/assets the keeper rules need. */
export interface SetMergeCandidate {
    id: string;
    name: string;
    releaseDate: Date | null;
    printedTotal: number;
    total: number;
    /** Id is live in the TCGdex /en/sets listing. */
    isLive: boolean;
    /** Attached card rows (name-pairing for block checks). */
    cards: MiniCard[];
    /** Attached card rows carrying an imageKey. */
    cardsWithImages: number;
    hasLogo: boolean;
    hasSymbol: boolean;
}

export type SetGroupReason = 'name' | 'redirects';

export interface DuplicateSetGroup {
    /** All candidates in the group (unsorted). */
    members: SetMergeCandidate[];
    keeper: SetKeeperChoice | null;
    reason: SetGroupReason;
    /** Reasons this group must NOT be auto-merged (null = actionable). */
    blocked: string | null;
}

/** Longest registered set-id prefix of a card id ("tk-ex-p-9" → "tk-ex-p"). */
export function setIdForCard(cardId: string, setIds: string[]): string | null {
    let best: string | null = null;
    for (const setId of setIds) {
        if (cardId.startsWith(`${setId}-`) && (!best || setId.length > best.length)) best = setId;
    }
    return best;
}

/**
 * Group duplicate set shells: name twins (normalizeSetName; e.g. swsh12pt5gg →
 * swsh12.5gg) plus EMPTY shells fully absorbed into one other set via card
 * redirects (fut20 → fut2020). A name/redirect edge must EXIST — never merge
 * on a shared print signature alone (that would wrongly fuse same-date,
 * same-count listings like the tk-xy 20-card trainer kits).
 *
 * Blocked (flagged for manual review, never auto-merged):
 *   - 0 or 2+ members live in TCGdex — same name may be distinct products.
 *   - A loser still holding cards whose names don't name-pair with keeper
 *     cards (card-level dedupe already merged what matched; anything left is
 *     an unmerged cross-shell product, e.g. ex10's Unown Mismagius).
 */
export function groupDuplicateSets(
    sets: SetMergeCandidate[],
    cardRedirects: ReadonlyArray<{ source: string; destination: string }> = []
): DuplicateSetGroup[] {
    const setIds = sets.map((s) => s.id);
    const parent = new Map<string, string>();
    const find = (x: string): string => {
        const p = parent.get(x) ?? x;
        if (p === x) return x;
        const root = find(p);
        parent.set(x, root);
        return root;
    };
    const union = (a: string, b: string) => void parent.set(find(a), find(b));
    const edgeReason = new Map<string, SetGroupReason>();
    const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

    // Name edges — same normalized set name.
    for (let i = 0; i < sets.length; i++) {
        for (let j = i + 1; j < sets.length; j++) {
            if (normalizeSetName(sets[i].name) === normalizeSetName(sets[j].name)) {
                union(sets[i].id, sets[j].id);
                edgeReason.set(key(sets[i].id, sets[j].id), 'name');
            }
        }
    }
    // Redirect edges — a historical card URL moved from shell A to shell B, but
    // only a FULLY ABSORBED shell links this way: all of its card rows are gone
    // and every redirect from it targets the same destination shell. Stray
    // cross-set card redirects (card-level shadow-set merges between distinct
    // products, e.g. swsh10-TGxx -> swsh10tg-TGxx while swsh10 still holds its
    // main listing) must not chain unrelated sets together.
    const redirectTargets = new Map<string, Map<string, number>>();
    for (const redirect of cardRedirects) {
        const sourceSetId = setIdForCard(redirect.source.replace(/^\/cards\//, ''), setIds);
        const destinationSetId = setIdForCard(redirect.destination.replace(/^\/cards\//, ''), setIds);
        if (!sourceSetId || !destinationSetId || sourceSetId === destinationSetId) continue;
        const targets = redirectTargets.get(sourceSetId) ?? new Map<string, number>();
        targets.set(destinationSetId, (targets.get(destinationSetId) ?? 0) + 1);
        redirectTargets.set(sourceSetId, targets);
    }
    for (const [sourceSetId, targets] of redirectTargets) {
        if (targets.size !== 1) continue; // scattered targets — no set-level claim
        const source = sets.find((s) => s.id === sourceSetId)!;
        if (source.cards.length > 0) continue; // card-level trivia, not a dead shell
        const [destinationSetId] = [...targets.keys()];
        union(sourceSetId, destinationSetId);
        const k = key(sourceSetId, destinationSetId);
        if (!edgeReason.has(k)) edgeReason.set(k, 'redirects');
    }

    const byRoot = new Map<string, SetMergeCandidate[]>();
    for (const set of sets) {
        const root = find(set.id);
        byRoot.set(root, [...(byRoot.get(root) ?? []), set]);
    }

    const groups: DuplicateSetGroup[] = [];
    for (const members of byRoot.values()) {
        if (members.length < 2) continue;

        const keeper = chooseSetKeeper(
            members.map((m) => ({
                id: m.id,
                isLive: m.isLive,
                hasLogo: m.hasLogo,
                hasSymbol: m.hasSymbol,
                cardsWithImages: m.cardsWithImages,
                cardCount: m.cards.length,
                total: m.total
            }))
        );
        const keeperRow = members.find((m) => m.id === keeper.winner.id)!;
        const losers = members.filter((m) => m.id !== keeperRow.id);
        const reason: SetGroupReason = members.some((m) =>
            members.some((o) => o.id !== m.id && edgeReason.get(key(m.id, o.id)) === 'name')
        )
            ? 'name'
            : 'redirects';

        const liveCount = members.filter((m) => m.isLive).length;
        const blockers: string[] = [];
        if (liveCount !== 1) {
            blockers.push(
                liveCount === 0
                    ? 'no member is live in TCGdex — cannot confirm the API-canonical id'
                    : 'multiple members live in TCGdex — possibly distinct products; verify manually'
            );
        }
        for (const loser of losers) {
            if (loser.cards.length === 0) continue;
            const { unmatchedBs } = matchByNameBijection(keeperRow.cards, loser.cards);
            if (unmatchedBs.length > 0) {
                blockers.push(
                    `${loser.id} holds ${unmatchedBs.length} card(s) whose names don't pair with ${keeperRow.id} (e.g. ${unmatchedBs[0].name})`
                );
            }
        }

        groups.push({
            members: [keeperRow, ...losers],
            keeper,
            reason,
            blocked: blockers.length > 0 ? blockers.join('; ') : null
        });
    }
    return groups;
}
