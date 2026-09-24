/**
 * Permanent redirects produced by the dedupe pipeline.
 *
 * Workflow:
 *   1. `pnpm db:audit-duplicates` (read-only) writes scripts/dedupe-report.json
 *   2. Review the report and pick keepers for each Class-1 group
 *      (remember: "No Logo" shadow cards may hold images TCGdex lacks — the
 *      merge must copy imageKey/imagesOptimized onto the keeper first)
 *   3. After the merge, add one entry per absorbed URL below (the report's
 *      `suggestedRedirects` has ready-to-paste pairs) and rebuild.
 *
 * next.config.ts turns these into 301s so link equity consolidates onto the
 * keeper URLs. Class-2 ("No Logo" variants) are NOT redirected — they stay
 * live with a canonical pointing at the main printing and are excluded from
 * sitemaps.
 */

export interface LegacyRedirect {
    /** Site-relative source path, e.g. '/cards/mcd11-12' */
    source: string;
    /** Site-relative destination path, e.g. '/cards/2011bw-12' */
    destination: string;
}

export const cardRedirects: LegacyRedirect[] = [
    // Example — pending keeper decision from the dedupe review:
    // { source: '/cards/mcd11-12', destination: '/cards/2011bw-12' },
];
