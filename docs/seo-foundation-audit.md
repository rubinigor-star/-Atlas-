# Atlas One SEO Foundation Audit

Date: 2026-08-13
Branch: `feature/atlas-seo-foundation-audit`
Production base: `main`
Method: Qiaomu-style evidence-first technical SEO audit

## Outcome

Primary business outcome: public event pages should be discoverable for event, artist and city searches while private, direct-only, tracking and preview surfaces stay out of search indexes.

## Evidence modes

- Code inventory: checked
- Route inventory: checked
- Metadata and structured data: checked
- Sitemap and robots controls: checked
- Tracking/referral URL behavior: checked
- Automated regression tests: added, verification pending at time of this record
- Vercel Preview rendered/runtime verification: pending
- Search Console/index evidence: not available in this branch audit

## High-impact findings and actions

### 1. Technical draft slugs could survive publication

Status: fixed with layered protection.

Observed behavior: newly created events start with a technical `draft-*` slug. The generic publish action changes status but did not guarantee conversion to a semantic public slug.

Actions:
- Added stable semantic slug generation using title, city and event date.
- Existing public slugs remain stable and are not automatically rewritten.
- Technical `draft-*` URLs are noindexed.
- Technical `draft-*` events are excluded from homepage discovery, tours and sitemap.
- Normal organizer event flow finalizes a semantic slug after publication.

Verification: regression tests added for slug generation and draft-slug detection.

### 2. DIRECT_ONLY visibility was not an SEO indexability rule

Status: fixed.

Observed behavior: catalog visibility controls existed, but sitemap and event metadata did not consistently enforce `DIRECT_ONLY` as non-indexable.

Actions:
- `DIRECT_ONLY` event pages receive `noindex, follow` metadata.
- They are excluded from sitemap.
- They are excluded from public tour dates and links.
- They do not emit public Event/Breadcrumb structured data.

### 3. Preview and canonical origins were conflated

Status: fixed.

Observed behavior: runtime Preview origin could be used as canonical origin after earlier environment-aware changes.

Actions:
- Separated runtime/public origin from canonical production origin.
- Canonicals, sitemap, robots host and structured data use the canonical production origin.
- Vercel Preview responses receive a global `X-Robots-Tag: noindex, nofollow, noarchive` header.

### 4. robots.txt and noindex controls conflicted

Status: fixed.

Observed behavior: private HTML pages were both blocked in robots.txt and assigned noindex headers. A crawler blocked by robots.txt may not retrieve the noindex directive.

Actions:
- robots.txt now blocks API crawling only.
- Private HTML routes remain crawlable but return `X-Robots-Tag: noindex, nofollow, noarchive`.
- Preview deployments return the noindex header globally.

### 5. Event structured data did not fully match buyer-visible pricing

Status: fixed for the available Atlas data model.

Actions:
- Offer price now uses the effective ticket price and the same buyer-facing service-fee calculation used by Atlas commerce logic.
- Hidden categories are excluded.
- Sold-out and in-stock availability are represented when applicable.
- Before/after the sales window, availability is omitted rather than using an unsupported value.
- Category-level sales windows are preferred over event-level windows.
- Internal Atlas description markers are stripped from metadata and Schema.
- Event language is exposed when a single primary event language is configured.
- `endDate` is added when event runtime is configured.
- Organizer URL is not fabricated when Atlas is not the organizer's public website.

Missing evidence/data:
- Explicit performer entity is not modeled consistently enough to add safely.
- Explicit event end time is not stored; runtime is used only when configured.
- Cancellation/reschedule event-state semantics are not modeled beyond DRAFT/PUBLISHED.

### 6. Sitemap contained a redirecting policy URL

Status: fixed.

Observed behavior: `/refund-policy` redirects to `/cancellation-policy` but was listed in sitemap.

Actions:
- Sitemap now lists `/cancellation-policy` directly.
- Added canonical metadata for the actual cancellation policy page.

### 7. Tours could expose non-indexable dates

Status: fixed.

Actions:
- Tours require at least one public, published, non-technical, non-direct-only event to be indexable.
- Non-indexable events are excluded from tour dates and links.
- Tours without public dates receive noindex.
- Tour pages emit Breadcrumb structured data when public.

## Public event URL contract

Preferred public pattern:

`/events/<semantic-title>-<city>-YYYY-MM-DD`

Rules:
- Technical `draft-*` slugs are never valid index targets.
- Once a semantic public slug exists, Atlas does not automatically rewrite it after title/date edits. URL stability is preferred over continuous keyword rewriting.
- Referral, promoter and UTM parameters do not change the canonical URL.

## Deferred strategic work

### Multilingual SEO

Current Atlas locale selection is adaptive on the same URL. This is acceptable for product UX but is not the strongest architecture for independent Russian, Hebrew and English organic visibility.

Recommended later migration:
- crawlable locale-specific URLs, for example `/ru/...`, `/he/...`, `/en/...`;
- per-locale metadata and content;
- reciprocal hreflang annotations;
- locale-specific sitemap coverage;
- controlled redirects and canonical rules.

This is intentionally deferred because it is a URL migration, not a safe foundation patch.

### Event lifecycle SEO

Future event-state model should support cancellation, postponement and rescheduling so public URLs can remain useful and structured data can reflect the real lifecycle instead of simply disappearing.

### Performer entities

Future event editor should model performer/artist separately from free-text event title when applicable. That will allow higher-confidence performer structured data and better reusable artist landing architecture.

## Release gates before merge

1. SEO regression workflow passes.
2. Vercel Preview build succeeds.
3. Preview response headers confirm global noindex.
4. Representative event page contains production canonical, clean metadata and valid Event JSON-LD.
5. Representative promoter/ref URL resolves to the event while canonical remains parameter-free.
6. DIRECT_ONLY representative page returns noindex and is absent from sitemap.
7. `draft-*` representative page is absent from homepage, tours and sitemap and is noindexed if directly reachable.
8. `/robots.txt` and `/sitemap.xml` return canonical production URLs.
9. No Production deployment or `main` merge occurs before these gates are satisfied.

## Rollback boundary

All changes are isolated in `feature/atlas-seo-foundation-audit`. Production and `main` remain unchanged until an explicit merge/deployment decision.
