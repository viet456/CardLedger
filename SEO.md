# SEO Runbook

Checklist for keeping the site indexable after deploys and data changes. Re-run Phases 3-4 after any change to URLs, redirects, sitemaps, canonicals, titles, or card id data.

## Phase 1 — Verify the deploy (first 10 minutes)

Prove the redirect graph is live (this also proves redirect destinations exist in the DB):

```bash
# Old card URL -> 301 -> keeper -> 200  (sample 5-10 source ids from src/lib/cardRedirects.ts)
curl -sI https://www.cardledger.io/cards/<old-id> | grep -i "HTTP\|location"
curl -sI https://www.cardledger.io/cards/<keeper-id> | head -1

# Legacy shells and query variants
curl -sI https://www.cardledger.io/cards.html | grep -i "HTTP\|location"
curl -sI "https://www.cardledger.io/cards?search=pikachu" | grep -i "HTTP\|location"

# Sitemaps
curl -sI https://www.cardledger.io/sitemap.xml | grep -i "HTTP\|content-type"
curl -s https://www.cardledger.io/sitemap.xml | head -20
curl -sI https://www.cardledger.io/sitemaps/<setId>.xml | head -1    # 200
curl -sI https://www.cardledger.io/sitemaps/bogus-set.xml | head -1  # 404

# robots + titles (exactly one | CardLedger per title)
curl -s https://www.cardledger.io/robots.txt
curl -s https://www.cardledger.io/sets/<setId> | grep -o "<title>[^<]*</title>"
```

Failure meanings:

- source 404s: redirects did not ship (check next.config.ts deploy)
- keeper 404s: data problem (redirect target missing from DB) — stop and fix data first
- doubled title suffix: layout template vs page title regression

## Phase 2 — CDN purge (only if Phase 1 shows stale content)

Check cf-cache-status / x-vercel-cache headers first. Cached 404s for old URLs hide new 301s until TTL expiry (sitemap routes send s-maxage=86400 + stale-while-revalidate).

- Cloudflare in front: Caching -> Configuration -> Purge Cache -> Custom Purge by prefix:
  https://www.cardledger.io/cards/, /sets/, /sitemaps/, /sitemap*.xml, /robots.txt (or Purge Everything).
- Other edge hosts: use their cache purge / redeploy option.

## Phase 3 — Google Search Console (same day)

1. Sitemaps report -> resubmit https://www.cardledger.io/sitemap.xml (the index feeds the child sitemaps). Expect Success + discovered URL count ~= live page count.
2. If an old 4xx/duplicate issue is still open in Page Indexing -> Validate Fix (restarts Google monitoring).
3. Request Indexing for highest-impression pages (quota ~10/day per property): home, /cards, top cards, top sets. URL Inspection -> Request Indexing. Spread over several days.
4. URL Inspection on 2-3 old URLs -> expect "Page with redirect" (healthy).
5. Rich Results Test on 2-3 card pages -> Product validates. Missing seller/gtin warnings are acceptable for a price tracker.

## Phase 4 — Monitor (first 2-4 weeks, 5 min/week)

- Page Indexing: Not found declining; Page with redirect appearing for old URLs; indexed count converging to canonical set; duplicate-without-canonical declining.
- Sitemaps: last-read date advancing; no fetch errors.
- Search Performance: clean titles (no doubled suffix); clicks migrating to keeper URLs.
- Crawl stats: Not found errors trending down.
- Core Web Vitals: field data reflects CLS/skeleton work after ~28 days.

## Permanent rules

- Keep all redirects (src/lib/cardRedirects.ts) indefinitely. Never delete: the old-to-new mapping is unrecoverable (rows and generator tooling are gone).
- Keep page titles bare: the layout template appends | CardLedger exactly once.
- Canonical ids are current TCGdex ids (api.tcgdex.net). Run `pnpm run db:audit-ids` after every data migration or merge: it flags Card rows TCGdex does not know, suggests keepers, and checks the redirect graph. If legacy rows survive, merge them into the TCGdex keeper (model the one-off repair on commit 5a13a6a — merge repoint or in-place rename, keeper wins unique collisions, dry-run first; the pairs in src/lib/cardRedirects.ts mirror it) and add a redirect pair per merged row. Re-run Phases 3-4 afterwards.
