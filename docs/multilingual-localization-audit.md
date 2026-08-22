# Atlas One localization audit

Date: 2026-08-22  
Branch: `feature/multilingual-platform`  
Base production commit audited: `0002341d42a2530a4f5d34dd4f2abaaa277b2e79`

## Executive summary

Atlas already contains useful RU/HE/EN copy in the public header, homepage, event page, checkout, order page, tickets and accessibility assistant, but it does not have one localization system. Language is inferred independently from a platform cookie, browser headers, request payloads, an event-content setting and a hidden ticket-design marker. The result is that a single purchase can change language between the event page, payment, order page, email, SMS, PDF and Wallet.

The implementation must separate four contexts:

1. `platformLocale` - generic Atlas browsing and customer account UI.
2. `staffLocale` - the employee's Office and mobile organizer interface.
3. `eventLocale` - the event's configured customer-facing language.
4. `communicationLocale` - immutable transaction snapshot used by an order or abandoned checkout.

The current Prisma schema is intentionally smaller than the production PostgreSQL runtime schema. Several production features create tables and columns at build/runtime with raw SQL. Localization persistence therefore needs both an additive Prisma schema change and an idempotent PostgreSQL migration/runtime guard.

## Current architecture map

### Public platform

- `src/lib/i18n.ts` defines `Locale = ru | he | en` and one small nested dictionary.
- `src/lib/server-locale.ts` resolves `atlas-locale` cookie, then `Accept-Language`, then English.
- `src/components/locale-provider.tsx` also reads `localStorage`, detects `navigator.language`, writes the cookie, and mutates the root `<html lang dir>`.
- `src/app/layout.tsx` renders the server locale into `<html>` and mounts one global provider.
- Public header, footer, homepage and several customer components use the provider.
- Many generic pages, metadata, errors and legal pages still contain hardcoded Russian.

### Event discovery versus event customer UI

- `EventLanguageSettings.primaryLanguage` is stored in a separately created runtime table.
- Values include RU, HE, EN, AR, MULTILINGUAL, NO_LANGUAGE_BARRIER and OTHER.
- `primaryLanguage` currently describes event content and catalog targeting only.
- `atlas-event-languages` cookie controls targeted catalog visibility.
- Event page, seat map and checkout currently reuse `platformLocale`, so switching the generic Atlas language also changes event purchase UI.
- There is no explicit customer communication locale for multilingual/no-language-barrier/other events.

### Office and staff

- Office uses the same global `LocaleProvider` and `atlas-locale` cookie as the public site.
- The language selector writes only local browser state and does not update an employee record.
- Server-rendered Office copy is predominantly hardcoded Russian, so changing the selector only translates the small subset reading `useLocale()`.
- Permission and role labels are Russian-only.
- Organization default language and per-employee override do not exist.

### Mobile organizer/staff app

- This repository contains the mobile API used by Atlas Office but not the native Expo client source.
- `/api/mobile/auth/me` returns identity, permissions and event IDs, but no resolved staff locale.
- Mobile auth and Office auth use the same `User`, which is the correct identity anchor for synchronized locale.
- Mobile API error strings and event-editor metadata contain hardcoded Russian.

### Ticket, PDF and Wallet

- `src/lib/ticket-language.ts` stores a locale marker as a hidden custom element in ticket design JSON.
- Ticket email, PDF HTML and Apple Wallet resolve language from that design marker.
- Ticket design is mutable and event-wide, so it cannot be the source of truth for an existing order.
- Ticket email is mostly localized, but its Apple Wallet CTA is always English.
- PDF HTML has Hebrew fonts and applies direction per text element. QR rendering is not mirrored, which is correct.
- `pdf-multilingual.ts` reverses Hebrew code points manually. That helper is unsafe for mixed BiDi and should not be used for customer ticket rendering; Chromium HTML rendering is the safer active path.
- Wallet labels are localized, but `logoText` is always English and locale is derived from the design marker.

## Independent locale sources found

| Source | Current use | Problem |
| --- | --- | --- |
| `atlas-locale` cookie | SSR public language | Also unintentionally drives events and Office |
| `localStorage[atlas-locale]` | Client public/Office language | Can override SSR after hydration |
| `navigator.language` | Client fallback | Duplicates server inference |
| `Accept-Language` | Server fallback | Correct only for platform/device fallback |
| `atlas-event-languages` cookie | Catalog targeting | Audience preference, not customer communication locale |
| `EventLanguageSettings.primaryLanguage` | Content language/catalog | Contains non-locale values |
| Checkout `locale` request property | HYP language and status email input | Browser-controlled and not snapshotted |
| `?locale=` query | Some order redirects | Mutable and not authoritative |
| Hidden ticket-design locale marker | Ticket/email/PDF/Wallet | Mutable presentation metadata contradicts transaction language |
| Hardcoded `ru-RU`, `he-IL`, `en-US/GB` | Formatting | Inconsistent Israeli product behavior |

## Customer communication channels

| Channel | Current status | Current locale source |
| --- | --- | --- |
| Event page | Partially RU/HE/EN | Platform cookie/browser |
| Seat map | Partially RU/HE/EN | Platform provider |
| Checkout and validation | Partially RU/HE/EN | Platform provider and Russian API errors |
| HYP payment page | Hebrew or English only | Checkout request locale |
| Order status page | RU/HE/EN | Platform cookie |
| Ticket email | Mostly RU/HE/EN | Ticket design marker |
| Approval received email | RU/HE/EN | Ephemeral request parameter |
| Approval rejection email | Russian | Hardcoded |
| Cancellation/refund email | Russian | Hardcoded |
| Cancellation request emails | Russian | Hardcoded |
| Ticket SMS | Russian | Hardcoded |
| Abandoned checkout email | Russian | Hardcoded |
| Future recovery SMS/WhatsApp | Adapter placeholder | No locale contract |
| PDF ticket | RU/HE/EN | Ticket design marker |
| Apple Wallet | Mostly RU/HE/EN | Ticket design marker |
| Office auth email/SMS | Russian | Hardcoded staff communication |

## Hardcoded-language hotspots

The repository contains Cyrillic product copy in 308 TypeScript/TSX files. The highest-risk customer and staff hotspots are:

- checkout/cart/hold API errors and checkout summary labels;
- Office pages and components, especially event editing, requests, scanner, finance, team and abandoned checkout;
- public about/FAQ/legal/customer account and generic error/empty states;
- order rejection, cancellation, recovery and SMS services;
- mobile event editor and mobile route errors;
- metadata in root/event layouts;
- ticket template editor labels and validation messages.

Russian data entered by organizers, such as event titles, descriptions, category names and venue names, is content rather than system copy and must not be automatically translated.

## Target persistence model

Add additive columns with constrained application-level locale values:

- `Organization.defaultStaffLocale` - default `ru` for existing organizations.
- `User.preferredLocale` - optional authenticated platform/user preference.
- `User.interfaceLocaleOverride` - optional staff override shared by Office and mobile.
- `Event.customerCommunicationLocale` - required event customer language.
- `Order.communicationLocale` - immutable transaction snapshot.
- `AbandonedCheckout.communicationLocale` - immutable checkout snapshot.

The existing `User` record is the organization member in this schema, so `User.interfaceLocaleOverride` is the per-member override described by the product model. Locale remains independent from role and permissions.

## Precedence rules

### Platform

`User.preferredLocale -> atlas-platform-locale cookie -> browser/device locale -> ru fallback`

The existing `atlas-locale` cookie remains readable during migration and is rewritten as the new platform cookie.

### Staff

`User.interfaceLocaleOverride -> User.preferredLocale -> Organization.defaultStaffLocale -> device/browser locale -> ru fallback`

The resolved value is returned by both Office and mobile session APIs. An employee change updates the shared user field; an admin can update it from Team.

### Event customer journey

`Event.customerCommunicationLocale` is authoritative. `primaryLanguage` may supply a migration/default only when it is RU, HE or EN. MULTILINGUAL, NO_LANGUAGE_BARRIER, OTHER and AR require an explicit RU/HE/EN customer communication language until those communication locales are supported.

### Transactions and communications

`Order.communicationLocale -> Event.customerCommunicationLocale -> ru safety fallback`

`AbandonedCheckout.communicationLocale -> Event.customerCommunicationLocale -> ru safety fallback`

The hidden ticket-design marker becomes a legacy fallback only for orders without a persisted locale. Design metadata never overrides an order snapshot.

## Migration strategy

1. Add columns without dropping, renaming or rewriting existing business columns.
2. Backfill event locale from `EventLanguageSettings.primaryLanguage` for RU/HE/EN; use `ru` for other existing values.
3. Backfill orders from their event customer locale.
4. Backfill abandoned checkouts from their event customer locale.
5. Keep all columns text-based for compatibility with the current SQLite development schema and PostgreSQL production conversion.
6. Add idempotent runtime SQL to the Vercel build before Prisma generation. Preview and production currently share PostgreSQL, so migration is strictly additive and reversible at application level.
7. Preserve the old cookie and ticket marker as read-only compatibility fallbacks during rollout.

## RTL and BiDi audit

- Root `<html lang dir>` already follows platform locale.
- Event and staff contexts need nested `lang`/`dir` boundaries because their locale can differ from the root platform locale.
- Seat-map geometry is physical and must remain LTR; only text panels and controls should become RTL.
- IDs, phone numbers, email, URLs, promo codes, QR/barcodes, prices and dates need `dir=ltr` or `unicode-bidi:isolate` where mixed into Hebrew.
- Logical CSS properties should be used for newly edited layout styles.
- Chevron meaning must follow navigation semantics, while QR, barcodes, brand marks and venue geometry must never be mirrored.
- The accessibility assistant is already localized and keyboard-operable. Its storage/classes must remain untouched by localization scope changes.

## Risks

1. Preview and production share a database. Only additive DDL is safe in this branch.
2. Vercel build scripts patch source files before `next build`; localization changes must avoid anchors rewritten by those scripts or update the scripts coherently.
3. Many server components render hardcoded Russian and cannot react to a client-only selector. Core Office pages must read resolved staff locale on the server or consume centralized copy.
4. HYP supports Hebrew/English page language, not Russian. Russian customer journeys must use English payment-provider UI while Atlas-owned UI remains Russian.
5. Event-entered content is not automatically multilingual. The system localizes Atlas copy, not organizer content.
6. Native mobile client code is outside this repository. This branch can implement synchronized locale persistence and mobile API contracts; the native client still needs to consume the returned locale and dictionaries in its own repository.
7. Legal, consent, refund and statutory cancellation translations preserve current meaning but require Israeli legal review before production acceptance.

## Implementation phases

1. Add schema fields, additive migration and locale persistence helpers.
2. Replace fragmented locale types/resolvers with a central type-safe engine.
3. Separate platform, staff, event and communication locale boundaries.
4. Add staff language controls and mobile API synchronization.
5. Snapshot event locale into checkout/order/abandoned checkout.
6. Move email, SMS, recovery, PDF and Wallet to order/checkout locale.
7. Localize core public, Office, scanner and mobile contracts in RU/HE/EN.
8. Add precedence, leakage, RTL and cross-context tests.
9. Run Prisma validation/generation, typecheck, tests, lint, production build and Vercel Preview verification.
