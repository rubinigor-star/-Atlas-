# Atlas One multilingual localization agent task

Work only in repository `rubinigor-star/-Atlas-` and branch `feature/multilingual-platform`.
Do not commit directly to `main` and do not merge to production until the work is reviewed and accepted.

## Objective
Turn Atlas One into a true multilingual platform. Initial supported languages: Russian (`ru`), Hebrew (`he`) and English (`en`). Architecture must allow Arabic, Ukrainian, French and more later without another rewrite.

This is NOT a literal translation task. Build one coherent localization architecture for four distinct contexts:
1. public Atlas platform,
2. organizer/staff Backoffice,
3. organizer/staff mobile app,
4. each event's complete customer journey and communications.

## Native Hebrew rule - critical
Hebrew must read as native Israeli product copy, not as Russian or English translated into Hebrew. For every Hebrew string, first understand the user intent and then write how an Israeli ticketing/ecommerce/event-management product would naturally say it. A grammatically correct but unnatural translation is unacceptable. You may change sentence structure and CTA length when meaning stays correct. Financial/legal/refund/payment/consent text must preserve exact meaning. Flag text needing legal review rather than changing legal meaning.

## 1. Platform locale
Controls homepage, marketplace/catalog, search/filters, global navigation/header/footer, login/register/auth, customer account, My Tickets, support/help, accessibility UI and statement, privacy/terms/cookies, 404/errors/loading/empty states, generic platform pages and SEO metadata where applicable.

Platform locale is a user preference. Suggested precedence: authenticated user preference -> explicit saved preference/cookie -> browser language -> safe default. Changing platform locale must not change an event's customer language.

## 2. Backoffice/staff locale
Controls all organizer web UI: dashboard, event creation/editing, orders, requests, finance, analytics, customers, guest lists, promoters, team, integrations/ValueCard, scanner management, abandoned checkout, ticket design, seat map editor, marketing, settings, forms, tables, validation, errors, toasts, modals and mobile-responsive Office UI.

Language belongs primarily to the individual employee, not the event. Recommended model:
- `Organization.defaultStaffLocale`
- user preferred locale and/or `OrganizationMember.interfaceLocaleOverride`

Suggested precedence:
`OrganizationMember.interfaceLocaleOverride -> User.preferredLocale -> Organization.defaultStaffLocale -> device/browser locale -> platform fallback`.

Different employees in the same organization may simultaneously use RU/HE/EN.

## 3. Mobile organizer/staff app locale
The mobile app must use the SAME staff locale model as Backoffice, not an unrelated app-only setting. An admin can set an employee's language in Team/Staff settings, and the employee may change their own language if product policy allows. Web Backoffice and app stay synchronized around the same staff interface locale.

Permissions and language are independent. Scanner-only Hebrew, finance English and owner Russian must all work. Localize login, event selection, scanner states, approvals, orders, settings, permission errors and in-app notifications.

## 4. Event customer/communication locale
Controls the complete customer journey for a specific event: event page, ticket/category selection, buyer seat map, cart, checkout, forms/validation, Atlas payment-facing UI, success/failure, order page, ticket page, PDF ticket, Apple Wallet, ticket email, approval received/accepted/rejected, cancellation/refund, abandoned checkout, resends, SMS, future WhatsApp, consent/legal notices, errors/warnings, dates, times and currency.

Existing event `primaryLanguage` is not sufficient because values such as MULTILINGUAL, NO_LANGUAGE_BARRIER and OTHER are not valid communication locales. Add a clear event customer locale such as `customerCommunicationLocale`. RU/HE/EN events can default accordingly. Multilingual/no-barrier/other events must allow an explicit primary customer communication language.

## Transaction locale snapshots
Persist locale when customer transaction begins/completes. At minimum implement equivalents of:
- `Order.communicationLocale`
- `AbandonedCheckout.communicationLocale`

Changing event settings later must not change language for existing orders/checkouts. Order locale becomes the source of truth for later ticket/email/SMS/refund communication unless there is an explicit documented override.

## Central localization engine
Audit and unify the fragmented current i18n logic. Use explicit concepts such as `platformLocale`, `staffLocale`, `eventLocale`, `communicationLocale`. Do not let components/services independently infer language from cookies, browser headers, ticket design metadata or arbitrary request params.

Use type-safe dictionaries/templates so missing RU/HE/EN keys fail during development/test/build where practical. Production fallback may be a logged safety net only. A Hebrew surface must not silently show Russian due to a missing key.

Audit the whole repository, especially `src/lib/i18n.ts`, server locale/browser/cookie logic, event language settings, public event local copy, ticket locale/design markers, order emails, status emails, cancellation/refund, recovery/abandoned emails, SMS, PDF, Wallet, checkout/payment, scanner web UI, Office, mobile app, accessibility and legal/consent text.

## RTL/BiDi
For Hebrew use correct `lang="he"` and `dir="rtl"` where appropriate. Audit navigation, sidebars, tables, pagination, breadcrumbs, chevrons/back-forward semantics, forms, dialogs, toasts, charts, seat maps, mobile navigation, scanner, phone/email/URLs/order IDs/promo codes, QR/barcodes, mixed Hebrew/English, prices, dates and times. Prefer logical CSS properties. Do not mirror QR codes, barcodes, numeric identifiers or brand marks.

## Formatting
Use locale-aware `Intl` formatting. Hebrew should use appropriate Israeli behavior such as `he-IL`. Choose/document suitable Russian and English locale tags for the Israeli product context while preserving timezone/business rules.

## Email/SMS/WhatsApp/PDF/Wallet
All transactional email and SMS must use the event/order communication locale. Remove hardcoded Russian customer messages. Hebrew email must be RTL-safe and contain no stray Russian/English buttons or paragraphs. Future WhatsApp should reuse the same localization layer. PDF and Apple Wallet must use order/event locale. Review the current ticket-design locale marker and prevent it from contradicting order communication locale without an explicit precedence rule. Hebrew PDF must render correctly.

## Platform versus event language
These are independent. Mandatory example: customer browses Atlas marketplace in English, opens a Hebrew event, the event/customer purchase journey is Hebrew, then returning to the generic marketplace can remain English. Browser/cookie language must not override an explicitly configured event customer locale.

## Staff language controls
Add settings UX so organization defines default staff language, member can have a per-member override, admin can set employee language from Team/Staff, employee can change their own language if allowed, and web Backoffice/mobile app use the same staff locale. Do not tie locale to role or permissions.

## Accessibility
Do not regress the production accessibility assistant. New locale selectors, forms, dialogs and navigation must remain keyboard accessible and screen-reader friendly. Accessibility UI itself must be localized naturally, including Hebrew RTL.

## Workflow
Start with a deep audit before mass edits. Produce an audit/report containing:
1. current localization architecture map,
2. every independent locale source,
3. all customer communication channels,
4. hardcoded-language hotspots,
5. proposed schema changes,
6. precedence rules,
7. migration strategy for existing events/orders/checkouts,
8. risks.

Then implement autonomously if architecture is clear and safe. Keep logical commits, suggested phases: audit, schema/persistence, central locale engine/dictionaries, public platform, Backoffice, mobile app, event customer journey, checkout/order, email, recovery, SMS, PDF/Wallet, Hebrew RTL polish, tests/hardcoded-string audit. Run build/typecheck/tests after major phases. Stay on this branch.

## Acceptance tests
Test RU/HE/EN for platform, Backoffice, mobile app and event journeys. Hebrew surfaces must have no accidental Russian/English system copy except proper nouns, brands, URLs and intentionally untranslated data. Repeat equivalent leakage checks for RU and EN.

Mandatory cross-context test:
- organizer Backoffice locale = Russian
- same employee mobile app locale = Russian
- event customer locale = Hebrew
- customer platform locale before event = English

Expected:
- organizer web Office remains Russian
- organizer mobile app remains Russian
- generic Atlas marketplace remains English
- event page/purchase journey are Hebrew
- ticket email, SMS, PDF/Wallet, abandoned reminder, cancellation/refund communication are Hebrew
- none of this changes organizer or platform preferences.

## Hebrew final QA
Perform final native Hebrew product-writing review across homepage, customer account, event flow, checkout, Backoffice, mobile app, scanner, emails and notifications. Rewrite awkward literal translations. Desired result: an Israeli user should feel Atlas was written naturally for Israel, not translated from Russian.

## Build/deployment
Work only on `feature/multilingual-platform`. Use Vercel Preview for validation. Fix build/type/runtime issues caused by this work. Do not merge to `main`. Finish with a report of changes, schema/migrations, tests, Preview URL, remaining manual checks, and confirmation that production `main` was not modified.