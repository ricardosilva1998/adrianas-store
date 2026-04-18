# Monthly SEO maintenance — spec

**Created:** 2026-04-18
**Status:** planned (defer until the site has meaningful content depth — a handful of products and 2–3 real editorial pages)

## Why

The foundation landed on 2026-04-18 (robots.txt, sitemap.xml, canonical + OG + Twitter meta, Product/Organization/BreadcrumbList JSON-LD). Once content starts accumulating, the SEO surface needs periodic auditing — titles collide, descriptions drift, products get added without good copy, Core Web Vitals regress, internal linking gets stale. Doing this manually is forgettable; doing it monthly via an automated job is not.

## When to switch it on

Light trigger to start this work (not strict gates):

- 10+ active products in `products`
- 3+ published CMS pages beyond `home` and `catalogo`
- At least one month of Google Search Console data (so we have real query/impression signal)

Before that, the dynamic sitemap + JSON-LD already shipped are enough; a monthly script would mostly audit empty surfaces.

## Scope — what the monthly run does

Think "audit report + safe regenerations", not "auto-publish changes."

### Automated checks (read-only, produce a report)

1. **Titles + meta descriptions**
   - Length bounds (title ≈ 50–60 chars, description ≈ 120–160 chars)
   - Duplicates across `products.name` and `pages.title`
   - Missing descriptions (product.description empty, page has no SEO description)

2. **Structured data**
   - Hit each product + page URL, extract `<script type="application/ld+json">`, validate against schema.org shape
   - Flag products with no `image` in Product JSON-LD (usually means no product image uploaded)

3. **Sitemap + robots**
   - GET `/sitemap.xml`, ensure every active product + published page is listed
   - GET `/robots.txt`, confirm `/admin/` + `/api/` still disallowed
   - Compare sitemap URL count delta vs last run — large drops signal accidental unpublishing

4. **Internal linking + orphan detection**
   - Crawl the site shallowly (≤ 2 hops from home)
   - Flag pages with 0 internal inbound links (orphans)
   - Flag broken internal links (404s)

5. **Core Web Vitals**
   - Call Google PageSpeed Insights API for home, catalog, a random product, and any high-traffic CMS page
   - Record LCP/INP/CLS for trend tracking
   - Fail if any goes into "poor" range

6. **Image hygiene**
   - Count `product_images` with empty `alt`
   - Flag hero/featured images > 500 KB

7. **Search Console signal (optional, if API creds configured)**
   - Pages with impressions but CTR < 1% → title/meta needs work
   - Queries where we rank 11–20 → close to page 1, prioritize content improvements
   - New 404s in the 404 report

### Optional LLM-assisted checks (gated behind a flag)

- Generate title/description suggestions for products missing them (never auto-apply; drop into admin review queue)
- Summarize top 3 content gaps vs seed keywords for the month

## Output shape

Each monthly run produces:

1. `docs/seo/reports/YYYY-MM.md` — human-readable report committed to the repo
2. A GitHub issue titled `SEO audit — YYYY-MM` with HIGH/MED/LOW items and owners
3. Optional: a Slack message summarizing blockers (only if any HIGH items)

### Report section order

```
## Summary (counts by severity)
## HIGH — blockers
## MED — worth fixing this month
## LOW — nice to have
## Trend (CWV, sitemap size, indexed pages) — last 6 months
## Raw data (JSON) — appendix
```

## Implementation options

**Option A — Claude Code scheduled agent (preferred long-term)**
- Register a cron trigger via the `schedule` skill (e.g., `0 9 1 * *` — 09:00 UTC on the 1st of each month)
- Trigger runs a slash command `/seo-audit` that executes `scripts/seo/audit.ts`
- Uses Node for deterministic checks, delegates LLM-assisted parts to Claude
- Pros: fits existing ECC harness, zero new infra, can write reports + open PRs

**Option B — GitHub Action (simplest start)**
- Monthly workflow runs `node scripts/seo/audit.ts --out docs/seo/reports/`, opens a PR with the report + new GH issue
- Pros: reliable cron, no dependency on a running agent
- Cons: no LLM-assisted parts unless wired to the Anthropic API

**Option C — In-app admin button**
- Single "Run SEO audit" button in `/admin` that does it on demand
- Pros: simplest, zero scheduling
- Cons: easy to forget; won't catch regressions

**Recommendation:** start with **B** (GitHub Action, deterministic checks only) once content depth warrants it, and layer in **A** later if we want LLM-assisted suggestions.

## Implementation outline (for whenever we turn it on)

1. `scripts/seo/audit.ts` — orchestrator that runs all checks and emits the report
2. `scripts/seo/checks/` — one file per check (titles, meta, jsonld, sitemap, cwv, links, images)
3. `scripts/seo/lib/crawler.ts` — shallow crawler (respects robots.txt, max depth 2, polite rate limit)
4. `scripts/seo/lib/psi.ts` — PageSpeed Insights client
5. `scripts/seo/templates/report.md.ts` — markdown report renderer
6. `.github/workflows/seo-monthly.yml` — cron trigger (Option B)

## Out of scope

- Auto-editing page content (too risky — admin must approve suggestions)
- Link building / off-page SEO
- Paid-search or ads
- Translation / hreflang (site is pt-PT only today; revisit if we add en-US)

## Dependencies / prerequisites

- `GOOGLE_PSI_API_KEY` env var for PageSpeed Insights (free tier is fine)
- `GOOGLE_SEARCH_CONSOLE_*` credentials — only needed for optional GSC checks; can skip initially
- Site must be live on a public URL (script needs real HTTP access)

## Success criteria

- Monthly report lands in repo on the 1st of each month with no manual intervention
- HIGH items never regress month-over-month (either fixed or escalated)
- Indexed-page count trends flat-or-up as we add content
- Core Web Vitals stay in "good" range for home + catalog + a representative product

## Related

- `docs/superpowers/specs/2026-04-17-hardening-punchlist.md` — current hardening work
- `CLAUDE.md` — site architecture (Astro SSR + React islands + PG)
- Shipped 2026-04-18: `src/pages/robots.txt.ts`, `src/pages/sitemap.xml.ts`, BaseLayout meta expansion, Product/Organization/BreadcrumbList JSON-LD
