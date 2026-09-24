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
