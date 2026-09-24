/**
 * LOCKED SORT CONTRACT — single source of truth for card ordering.
 *
 * Do not add `.reverse()` calls or page-local comparators anywhere. Every
 * ordering decision in the app (SSR + CSR) routes through this module so that
 * server-rendered HTML and client re-sorts always agree.
 *
 * `compareCardNumbers` is verbatim the within-set comparator from
 * `scripts/generateCardIndex.ts` (lines 183-193), i.e. it reproduces the
 * canonical artifact/haystack order:
 *   - numeric card numbers first, ascending by parseInt (1 < 2 < 10 < 100),
 *   - then non-numeric numbers (e.g. "TG01"), localeCompare(numeric),
 *   - `sortOrder: 'desc'` is exactly this sequence reversed
 *     (TG01 -> ... -> 100 -> 10 -> 2 -> 1).
 *
 * Sort keys and their semantics:
 *   'num'  (set page default) numeric-first ascending; desc = reversed.
 *   'n'    name localeCompare; desc = Z->A. Ties -> 'num' ascending
 *          ("first card numbers first").
 *   'price' desc = high->low, asc = low->high. Unpriced cards ALWAYS sort
 *          last, in both directions.
 *   'pS'   (/cards only) pokedex number ascending; unranked cards always
 *          last in both directions.
 *   'rD'   (/cards only) set releaseDate desc (artifact order); asc flips
 *          only the date axis. Ties -> larger set first (total desc), then
 *          'num' ascending.
 *   'relevance' (/cards + ?search=) uFuzzy's customSort order, untouched.
 *
 * Cross-set tie-breakers (after the primary key):
 *   'num' / 'n' / 'price' / 'pS' -> 'num' ascending -> newer set first
 *   (set releaseDate desc) -> stable input (artifact) order.
 *
 * `sortOrder` is applied INSIDE each comparator (multiplied into the primary
 * comparison only); tie-breakers keep their fixed direction so grouping stays
 * coherent in both directions.
 *
 * Natural direction when `sortOrder` is absent from the URL:
 *   'rD' | 'price' -> 'desc'     everything else -> 'asc'
 *
 * Entry points:
 *   /cards               -> 'rD' 'desc'  (= artifact order, no-sort fast path)
 *   /cards?search=...    -> 'relevance'
 *   /cards?setId=...     -> 'rD' 'desc'  (same as bare /cards)
 *   /sets/{id}           -> 'num' 'asc'  (matches SSR)
 *   ?sortBy=...&sortOrder=... honored literally (validated), always winning.
 */

import type { SortableKey } from '@/src/services/pokemonCardValidator';
import type { DenormalizedCard } from '@/src/shared-types/card-index';

export type SortOrder = 'asc' | 'desc';

/** Numeric card numbers first (ascending), non-numeric after. See module docs. */
export function compareCardNumbers(numA: string, numB: string): number {
    const a = parseInt(numA, 10);
    const b = parseInt(numB, 10);
    const aIsNum = !isNaN(a);
    const bIsNum = !isNaN(b);

    if (aIsNum && bIsNum) return a - b; // numeric vs numeric
    if (aIsNum) return -1; // numeric before non-numeric
    if (bIsNum) return 1;
    return numA.localeCompare(numB, undefined, { numeric: true }); // string fallback
}

/** Natural (default) direction of a sort key when the URL omits sortOrder. */
export function naturalSortOrder(sortBy: SortableKey | 'relevance' | undefined): SortOrder {
    return sortBy === 'price' || sortBy === 'rD' || sortBy === 'relevance' ? 'desc' : 'asc';
}

/**
 * Resolve the effective sort purely from URL params (the only sort authority).
 * Invalid/absent values fall back to `fallbackSortBy` + its natural direction.
 */
export function resolveSort(
    sortByRaw: string | null,
    sortOrderRaw: string | null,
    allowed: readonly (SortableKey | 'relevance')[],
    fallbackSortBy: SortableKey | 'relevance'
): { sortBy: SortableKey | 'relevance'; sortOrder: SortOrder } {
    const sortBy = (allowed as readonly string[]).includes(sortByRaw ?? '')
        ? (sortByRaw as SortableKey | 'relevance')
        : fallbackSortBy;
    const sortOrder: SortOrder =
        sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? sortOrderRaw : naturalSortOrder(sortBy);
    return { sortBy, sortOrder };
}

/**
 * Set-page / SSR comparator over DenormalizedCard.
 * Default is 'num' 'asc' (locked entry point for /sets/{id}).
 * Returns a new array; the input is not mutated.
 */
export function sortDenormalizedCards(
    cards: DenormalizedCard[],
    sortBy?: SortableKey | 'relevance' | null,
    sortOrder?: SortOrder | null
): DenormalizedCard[] {
    const by: SortableKey = sortBy === 'n' || sortBy === 'price' ? sortBy : 'num';
    const order: SortOrder = sortOrder ?? naturalSortOrder(by);
    const dir = order === 'desc' ? -1 : 1;

    return [...cards].sort((a, b) => {
        switch (by) {
            case 'price': {
                const priceA = a.price ?? null;
                const priceB = b.price ?? null;
                // Unpriced always last, in both directions
                if (priceA === null && priceB === null) return compareCardNumbers(a.num, b.num);
                if (priceA === null) return 1;
                if (priceB === null) return -1;
                const diff = (priceA - priceB) * dir;
                return diff !== 0 ? diff : compareCardNumbers(a.num, b.num);
            }
            case 'n': {
                const diff = a.n.localeCompare(b.n) * dir;
                return diff !== 0 ? diff : compareCardNumbers(a.num, b.num); // tie -> num asc
            }
            case 'num':
            default:
                return compareCardNumbers(a.num, b.num) * dir;
        }
    });
}

/** Minimal card shape needed by the /cards (cross-set) comparator. */
export interface BrowseSortCard {
    id: string;
    n: number; // name id (lookup into ctx.names)
    num: string;
    s: number; // set index (lookup into ctx.sets)
    pS: number | null;
}

export interface BrowseSortContext {
    names: string[];
    sets: { total: number; releaseDate: string }[];
    /** Effective display price of a card (NM-first), or null when unpriced. */
    priceOf: (card: BrowseSortCard) => number | null;
}

/**
 * /cards (cross-set) comparator. `sortOrder` is applied inside the comparator;
 * there is deliberately no `.reverse()` anywhere in the pipeline.
 * Returns a new array; the input is not mutated.
 */
export function sortBrowseCards<T extends BrowseSortCard>(
    cards: T[],
    sortBy: SortableKey | 'relevance',
    sortOrder: SortOrder,
    ctx: BrowseSortContext
): T[] {
    const dir = sortOrder === 'desc' ? -1 : 1;
    const setReleaseDate = (s: number) => new Date(ctx.sets[s].releaseDate).getTime();

    return [...cards].sort((a, b) => {
        switch (sortBy) {
            case 'price': {
                const priceA = ctx.priceOf(a);
                const priceB = ctx.priceOf(b);
                // Unpriced always last, in both directions
                if (priceA === null && priceB === null) break;
                if (priceA === null) return 1;
                if (priceB === null) return -1;
                const diff = (priceA - priceB) * dir;
                if (diff !== 0) return diff;
                break;
            }
            case 'n': {
                const diff = ctx.names[a.n].localeCompare(ctx.names[b.n]) * dir;
                if (diff !== 0) return diff;
                break;
            }
            case 'pS': {
                const pokedexA = a.pS ?? null;
                const pokedexB = b.pS ?? null;
                // Unranked (no pokedex number) always last, in both directions
                if (pokedexA === null && pokedexB === null) break;
                if (pokedexA === null) return 1;
                if (pokedexB === null) return -1;
                const diff = (pokedexA - pokedexB) * dir;
                if (diff !== 0) return diff;
                break;
            }
            case 'rD': {
                const diff = (setReleaseDate(a.s) - setReleaseDate(b.s)) * dir;
                if (diff !== 0) return diff;
                // Tie-breaker: set size (prevents interweaving on ascending sort)
                if (a.s !== b.s) return ctx.sets[b.s].total - ctx.sets[a.s].total;
                // Tie-breaker: card number
                return compareCardNumbers(a.num, b.num);
            }
            case 'num':
            default: {
                const diff = compareCardNumbers(a.num, b.num) * dir;
                if (diff !== 0) return diff;
                break;
            }
        }

        // Shared cross-set tie-breakers: 'num' asc -> newer set first -> stable order
        const numDiff = compareCardNumbers(a.num, b.num);
        if (numDiff !== 0) return numDiff;
        return setReleaseDate(b.s) - setReleaseDate(a.s);
    });
}
