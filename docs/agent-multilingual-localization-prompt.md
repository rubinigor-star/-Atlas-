# Atlas One multilingual localization agent task

Work in repository `rubinigor-star/-Atlas-`.

MANDATORY BRANCH RULE: continue only from `feature/accessibility-i18n-foundation`. Do not commit directly to `main`. Do not merge to `main` until all acceptance criteria below are satisfied and reviewed.

## Objective

Turn Atlas One into a real multilingual ticketing platform. Initial supported languages are Russian (`ru`), Hebrew (`he`) and English (`en`), with architecture designed to add Arabic, Ukrainian, French and other languages later without another rewrite.

This is not a find-and-replace translation job. Build one coherent localization architecture for:

1. the public Atlas platform,
2. organizer Backoffice,
3. the organizer/staff mobile application,
4. each event's complete customer journey and communications.

The existing accessibility work on this branch must remain intact and Hebrew RTL must work correctly together with accessibility settings.

## Critical Hebrew quality rule

Hebrew must be native Israeli product copy, not a literal translation from Russian or English.

Do not treat Russian as the canonical source text for Hebrew. For every Hebrew string, first determine the user intent and context, then write the formulation an Israeli product team would naturally use in a ticketing, ecommerce, payments or event-management product.

A grammatically correct translation is not sufficient if it sounds translated, formal in the wrong way, unnatural, or uncommon in Israeli UX.

You may change sentence structure, terminology and CTA length between languages when the meaning remains correct. Prefer short, familiar Israeli product language. Keep terminology consistent across the product.

Financial, legal, refund, payment and consent texts must preserve exact meaning. If wording needs legal review, flag it instead of inventing a different legal meaning.

## Locale architecture: four related but distinct contexts

### 1. Platform locale

Controls general public Atlas surfaces that are not owned by one event:

- homepage
- marketplace/catalog
- search and filters
- global header/footer/navigation
- login and registration
- customer account
- My Tickets
- general support/help
- accessibility UI and accessibility statement
- privacy, terms, cookies/consents
- 404/error/loading/empty states
- generic customer-facing platform pages
- SEO metadata where applicable

Resolution order should be explicit user preference, authenticated user preference if available, saved cookie/storage, browser language, then safe platform default.

Changing platform locale must not change an event's configured customer language.

### 2. Backoffice/staff interface locale

Controls every organizer-facing web interface:

- dashboard
- event creation/editing
- orders and requests
- finance
- analytics
- customers
- guest lists
- promoters
- team
- integrations
- ValueCard
- scanner management
- abandoned checkout dashboard/settings
- ticket design
- seat map editor
- marketing
- modals
- tables
- validation/errors/toasts
- settings
- mobile-responsive organizer web UI

Backoffice language belongs primarily to the individual staff member, not to the event.

Recommended model:

- `Organization.defaultStaffLocale`
- a user-level preferred locale and/or `OrganizationMember.interfaceLocaleOverride`

Resolution should support this type of order:

`OrganizationMember.interfaceLocaleOverride -> User.preferredLocale -> Organization.defaultStaffLocale -> device/browser locale -> platform fallback`

A company may have one employee using Russian, another Hebrew and another English simultaneously.

Changing one employee's language must not change another employee, organization event language, or customer communications.

### 3. Mobile organizer/staff application locale

The staff mobile application must use the SAME staff interface locale model as Backoffice.

Do not create an unrelated app-only language preference unless there is a strong technical reason.

If an employee is configured as Hebrew, both their web Backoffice and mobile app should be Hebrew. They may be allowed to change their own interface language in settings. Organization admins should also be able to set the employee's initial/current language from Team/Staff settings.

Permissions and language are independent concepts.

Examples:

- scanner-only employee + Hebrew UI
- finance employee + English UI
- owner/admin + Russian UI

All mobile areas must localize accordingly, including scanner states, success/error sounds labels, approvals, orders, event selection, settings, login/authentication, permissions-related messages and notifications shown inside the application.

Do not let event language determine staff app language.

### 4. Event customer locale / communication locale

Controls the complete customer journey for a specific event:

- event detail page
- ticket/category selection
- seat map buyer UI
- cart
- checkout
- forms and validation
- payment-related Atlas UI
- success/failure states
- order page
- ticket page
- PDF ticket
- Apple Wallet
- transactional ticket email
- approval request received
- approval accepted
- rejection
- cancellation/refund
- abandoned checkout reminders
- resend notifications
- SMS
- future WhatsApp messaging
- customer event consent and legal notices
- event-specific errors/warnings
- dates, times and currency formatting

Existing `primaryLanguage` is not sufficient because values such as `MULTILINGUAL`, `NO_LANGUAGE_BARRIER` and `OTHER` are not valid communication locales.

Create a clear event customer locale such as `customerCommunicationLocale` or an equivalent well-named field/resolver.

Defaults can derive from event primary language when primary language is RU/HE/EN. For multilingual/no-language-barrier/other events, allow selection of a primary customer communication language.

## Snapshot locale on transactions

Persist the communication locale at the time a customer transaction begins/completes.

At minimum implement an equivalent of:

- `Order.communicationLocale`
- `AbandonedCheckout.communicationLocale`

The purpose is to prevent future changes to event settings from changing the language of existing customers' communications.

Once an order exists, order communication locale becomes the source of truth for its future email/SMS/refund/ticket communication unless an explicitly documented override exists.

## Central localization engine

Audit the current i18n implementation and replace fragmented locale logic with a clear, type-safe system.

A possible structure is:

```text
src/lib/localization/
  locale-registry.ts
  platform-locale.ts
  staff-locale.ts
  event-locale.ts
  communication-locale.ts
  format.ts
  translations/
    ru/
    he/
    en/
```

You may choose a better structure for the existing codebase.

Avoid ambiguous generic names such as `locale` or `language` when the context is unclear. Prefer concepts such as `platformLocale`, `staffLocale`, `eventLocale`, `communicationLocale`.

Do not let each component/service independently infer language from unrelated cookies, browser headers, ticket design metadata or arbitrary request parameters.

## Remove hardcoded customer and staff UI strings

Audit the entire repository for hardcoded Russian, Hebrew and English user-facing strings.

Move system copy into the localization architecture.

Do not leave customer-facing or Backoffice-facing strings embedded directly in components/services when they belong in dictionaries/templates.

Use type safety so missing RU/HE/EN keys fail in development/test/build where practical.

Production fallback may exist only as a safety net and should be observable/logged. A Hebrew event must not silently display Russian because a Hebrew key is missing.

## Existing areas that must be audited carefully

The current codebase already has fragmented language handling. Explicitly inspect and unify:

- `src/lib/i18n.ts`
- server locale/browser/cookie logic
- event language settings
- public event page local copy
- ticket language/design locale markers
- order ticket emails
- order status emails
- cancellation/refund emails
- recovery/abandoned checkout emails
- SMS ticket delivery
- PDF ticket rendering
- Apple Wallet localization
- checkout and payment flow
- scanner web UI
- organizer Office
- mobile application source and scanner
- accessibility component and statement
- legal/consent texts

Do not assume this list is exhaustive. Search the whole repository.

## Hebrew RTL and BiDi requirements

For Hebrew surfaces use correct `lang="he"` and `dir="rtl"` at the appropriate document/surface level.

RTL is not only text alignment. Audit:

- navigation
- sidebar direction
- tables
- cards
- pagination
- breadcrumbs
- chevrons/arrows/back-forward semantics
- forms and labels
- inputs
- dialogs/dropdowns
- toasts
- charts
- seat maps and controls
- mobile navigation
- scanner UI
- phone numbers
- email addresses
- URLs
- order/ticket IDs
- promo codes
- QR/barcodes
- mixed Hebrew/English strings
- prices and `₪`
- dates/times

Prefer CSS logical properties such as `margin-inline`, `padding-inline`, `inset-inline`, `border-inline` where appropriate.

Do not mirror things that should not be mirrored, such as QR codes, barcodes, numeric identifiers or brand marks.

## Formatting

Use locale-aware formatting rather than translated handcrafted output.

Use `Intl` or equivalent for dates, times, numbers and money.

Hebrew should use appropriate Israeli locale behavior such as `he-IL`; choose and document appropriate locale tags for Russian and English in the Israeli product context. Preserve event timezone/business rules.

## Email

All transactional emails must resolve language from the proper event/order communication locale.

Audit every email flow, including:

- ticket delivery
- pending approval received
- accepted/approved
- rejected
- payment/status
- cancellation
- refund
- abandoned checkout first reminder
- final reminder
- resend
- future service messages

Hebrew email must use RTL-safe HTML and contain no accidental Russian/English system buttons or paragraphs.

## SMS and future WhatsApp

Localize SMS using the same communication locale.

Remove hardcoded Russian ticket SMS.

Design message templates so future WhatsApp can reuse the same localization layer rather than inventing another translation system.

## PDF and Apple Wallet

PDF tickets and Wallet passes must use order/event communication locale.

Review the current ticket-design locale marker. Do not allow an unrelated hidden ticket locale to contradict the order communication language without an explicit documented override rule.

Hebrew PDF text must render correctly and respect RTL/BiDi where appropriate.

## Event page versus platform language

The general Atlas platform language and event customer language are independent.

Mandatory example:

- customer is browsing Atlas marketplace in English
- event customer locale = Hebrew
- opening that event should enter the Hebrew event/customer purchase journey
- after returning to the generic marketplace, platform preference can remain English

Do not let a Russian browser cookie override an explicitly configured Hebrew event customer experience.

## Backoffice and app language controls

Add appropriate settings UX so:

- organization can define default staff language
- staff member can have a per-member language override
- admin can set employee language in Team/Staff configuration
- staff member can change their own language if permissions/product policy allow it
- web Backoffice and mobile app stay synchronized around the same staff locale model

Do not tie locale to role or permission.

## Accessibility interaction

Do not regress accessibility work already present on `feature/accessibility-i18n-foundation`.

All new locale selectors, dialogs, forms and navigation must remain keyboard accessible and work with screen readers.

Accessibility UI itself must be localized correctly, including native Hebrew wording and RTL.

## Workflow

Before large modifications, produce an audit in the repository or agent report containing:

1. current localization architecture map,
2. every independent locale source discovered,
3. all customer communication channels,
4. hardcoded language hotspots,
5. proposed database/schema changes,
6. proposed locale precedence rules,
7. migration strategy for existing events/orders/checkouts,
8. risks.

Then implement without waiting for extra approval if the architecture is clear and safe.

Keep commits logical and reviewable. Suggested phases:

1. audit and architecture
2. schema/persistence and migration
3. central locale registry/resolvers/dictionaries
4. public platform
5. Backoffice
6. staff/mobile application
7. event/public customer journey
8. checkout/order
9. email
10. abandoned recovery
11. SMS
12. PDF/Wallet
13. Hebrew RTL/BiDi polish
14. tests and hardcoded-string audit

Do not make one giant unreviewable commit.

Run build/typecheck/tests after major phases. Do not merge to `main`.

## Testing and acceptance criteria

Create or use test data for RU, HE and EN.

### Platform tests

Set platform locale HE and inspect the full generic public Atlas experience. No accidental Russian/English system copy may remain, excluding proper nouns, brands, URLs and intentionally untranslated data.

Repeat for RU and EN.

### Backoffice tests

Test staff users in RU, HE and EN. Full organizer Office must work in each language.

Changing one staff member's language must not change event customer locale or another employee's locale.

### Mobile application tests

Test staff mobile app in RU, HE and EN, including scanner and permission-limited users.

The employee's chosen/configured staff interface language must be reflected in both web Backoffice and app.

### Event customer journey tests

For a Hebrew event, verify the entire journey:

- event page
- ticket selection
- seat selection if applicable
- cart/checkout
- payment-facing Atlas UI
- success/order page
- ticket
- PDF
- email
- SMS
- abandoned checkout
- refund/cancellation communication

There must be no Russian or English system-copy leakage.

Repeat equivalent tests for RU and EN.

### Mandatory cross-context test

Use this exact scenario:

- organizer/staff Backoffice locale = Russian
- same employee mobile app locale = Russian
- event customer locale = Hebrew
- customer platform locale before entering event = English

Expected result:

- organizer web Office remains Russian
- organizer mobile app remains Russian
- general customer Atlas marketplace remains English
- event page and purchase journey are Hebrew
- ticket email is Hebrew
- SMS is Hebrew
- PDF/Wallet customer text is Hebrew
- abandoned reminder is Hebrew
- cancellation/refund communication is Hebrew
- none of those actions changes organizer or platform preferences

This test is mandatory.

## Hebrew quality acceptance

A final Hebrew QA pass is mandatory across homepage, customer account, event flow, checkout, Backoffice, mobile app, scanner, email and notifications.

Review Hebrew as product writing, not only as translation correctness.

Flag awkward literal translations and rewrite them naturally.

The desired result is that an Israeli user should not feel that Atlas was written in Russian and translated into Hebrew.

## Build/deployment rule

Work only on `feature/accessibility-i18n-foundation`.

Use Vercel Preview builds for validation. Resolve all build/type/runtime errors caused by this work.

Do not open/merge a production PR until the multilingual implementation passes the acceptance criteria and has been reviewed.