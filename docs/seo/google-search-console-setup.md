# Google Search Console — setup & verification

**Purpose:** prove to Google that we own `drisclub.com`, submit the sitemap, and start receiving search-traffic data.

We ship two verification paths — use whichever is easier for your DNS provider. HTML is faster; DNS is more durable.

## Prerequisites

- Site is live at its production URL (e.g. `https://drisclub.com`)
- You can log into [Google Search Console](https://search.google.com/search-console)
- You can edit DNS records at your registrar (e.g. Namecheap, Cloudflare, GoDaddy) — only needed for Option B

## Option A — HTML meta tag verification (fastest)

1. Open Search Console → **Add property** → choose **URL prefix** → enter `https://drisclub.com` → **Continue**.
2. On the verification screen pick **HTML tag**. Google shows a tag like:
   ```html
   <meta name="google-site-verification" content="XXXXXXXXXXXXXXXXXXXX" />
   ```
   Copy only the value inside `content="..."`.
3. In **Railway** → project → **Variables**, add:
   ```
   GOOGLE_SITE_VERIFICATION=XXXXXXXXXXXXXXXXXXXX
   ```
4. Redeploy (Railway triggers automatically on env change).
5. Back in Search Console, click **Verify**.

The storefront emits the meta tag only when `GOOGLE_SITE_VERIFICATION` is set (see `src/layouts/BaseLayout.astro`). Admin pages (`/admin/*`) already have `noindex` and are out of scope.

## Option B — DNS TXT record verification (preferred long-term)

Switching to this after step 5 above is fine — Search Console keeps the site verified as long as at least one method is valid.

1. Open Search Console → **Add property** → choose **Domain** → enter `drisclub.com` (no scheme, no `www`) → **Continue**.
2. Google shows a TXT record payload like `google-site-verification=XXXXXXXXXXXXXXXXXXXX`.
3. At your DNS provider, add the record:

   | Field | Value |
   |---|---|
   | Type | `TXT` |
   | Host / Name | `@` (the root — provider may also call it `drisclub.com` or leave the field blank) |
   | Value | `google-site-verification=XXXXXXXXXXXXXXXXXXXX` (keep the quotes if the provider auto-wraps) |
   | TTL | `3600` (1 h) or provider default |

4. Save. Most providers propagate within minutes; allow up to 24 h worst case.
5. In Search Console click **Verify**.

> If you already have other TXT records on `@` (SPF, DKIM, etc.), add a **new, separate** TXT record. Never concatenate values into one TXT.

## After verification — submit the sitemap

1. In Search Console, left nav → **Sitemaps**.
2. Enter `sitemap.xml` → **Submit**.
3. The sitemap is served dynamically from `src/pages/sitemap.xml.ts` and covers home, catalog, published CMS pages, and active products.

Google typically starts crawling within a few hours; the **Coverage** report populates over 24–72 h.

## Useful follow-ups

- **URL inspection** — paste any product URL to request indexing manually for new products.
- **Performance** — queries, CTR, impressions. Real data arrives after ~7 days of crawling.
- **Core Web Vitals** — populates from Chrome UX Report once the site has enough traffic; crosscheck against PageSpeed Insights while volume is low.
- **Coverage** — look for **Excluded** pages. Expect `/admin/*`, `/api/*`, `/carrinho`, `/checkout`, `/obrigado` to show up as "Excluded by 'noindex' tag" or "Blocked by robots.txt" — that's intentional.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Verify button fails, says "meta tag not found" | Site hasn't redeployed yet after setting the env var | Check Railway deploy log, wait for it to finish, retry |
| DNS verify fails | TTL not elapsed, or the TXT value got wrapped in extra quotes | `dig +short TXT drisclub.com` should show the value; fix the provider record if it doesn't |
| `sitemap.xml` shows `Couldn't fetch` | Site is behind auth or returned 5xx at crawl time | Open the URL incognito; check Railway logs for errors |
| New products don't appear in search | Normal — can take days/weeks; accelerate with URL inspection → Request indexing | — |

## Related

- `src/pages/robots.txt.ts` — controls what crawlers may see
- `src/pages/sitemap.xml.ts` — dynamic sitemap
- `src/layouts/BaseLayout.astro` — emits canonical/OG/Twitter meta + optional `google-site-verification`
- `docs/superpowers/specs/2026-04-18-monthly-seo-maintenance.md` — planned monthly audit that also checks Search Console data
