# Atlas Tickets MVP

Atlas is a mobile-first ticketing platform prototype for Israeli live events. It demonstrates one complete vertical flow: an organizer publishes an event, a buyer reserves general admission or a VIP table, completes a test checkout, receives unique QR tickets and PDFs, and door staff validates each ticket once.

> This is an MVP. It does not process real payments and must not be used for commercial ticket sales without the security and infrastructure work listed below.

## What works

- Published event catalog and event details
- Per-event sales mode: instant ticket delivery or organizer approval before payment
- Event admission format chosen at creation: general admission or reserved seating
- Fixed ticket prices or scheduled price phases such as Early Bird and Regular
- Per-ticket sales windows and maximum quantity per order
- Organizer application queue with approve/reject decisions and applicant eligibility answers
- Approved applications reserve inventory for a 24-hour test-payment window
- Three-panel venue-map builder with a zoomable canvas, object library and property inspector
- Drag-and-drop map objects with persisted position, direct rotation handle, exact angle controls and a collapsible property inspector
- Rectangular and round tables, sofas, chair rows, zones, stage, bar and text objects
- Central ticket types with organizer-defined map colors; the map stores references to tickets instead of duplicate prices
- Whole-object, individual-seat and seat-range ticket assignment, including multiple price bands inside one row
- Whole table/sofa sales or individually reservable chairs
- Buyer seat selection on the same responsive map
- Russian/Hebrew language switch with RTL foundations and bilingual purchase/map flows
- Server-side test checkout with idempotency keys
- Amounts stored in agorot, never floating point
- Unique, opaque ticket codes and order numbers
- QR ticket screen and downloadable server-generated PDF
- Mobile camera scanner plus manual code entry
- Atomic first check-in, duplicate, cancelled and unknown states
- Entry counter and scan log
- Organizer dashboard, sales metrics and order list
- Separate customer website and installable mobile-first `Atlas Office` PWA
- Server-enforced organizer permissions, optional per-event staff scope and role templates
- Mobile approval inbox for private events, one-tap approve/reject actions and audit trail
- Team screen for granular staff permissions: events, requests, orders, scanner, analytics and team management
- Event creation/editing, publish controls, categories and VIP tables with local poster upload
- Ticket cancellation and code regeneration
- Per-event Ticket Studio: movable custom text, live event/customer fields, photos, logo, background, colors and QR placement
- The saved ticket template drives both the customer ticket screen and downloadable PDF
- Apple Wallet `.pkpass` generation when Apple Pass Type certificates are configured
- PassKit web-service endpoints for device registration, changed-pass lookup, pass refresh and device logs
- Event date/title changes, cancellation, code regeneration and first check-in version installed Wallet passes and trigger APNs updates when configured
- Minimal promo code (`ATLAS10`) and referral data (`MALINA`)
- Seed event, users and test order

### Approval-required event flow

1. The organizer selects `APPROVAL_REQUIRED` in the event manager and defines the question shown to applicants.
2. The buyer selects a category or table and submits contact and eligibility information without payment.
3. Atlas creates a `PENDING_APPROVAL` request without issuing tickets or reducing inventory.
4. An authorized organizer approves or rejects the request from the mobile Atlas Office inbox at `/office/requests`.
5. Approval atomically reserves the inventory/table and opens a 24-hour `AWAITING_PAYMENT` window.
6. The demo payment changes the order to `PAID` and only then creates unique QR tickets and PDFs.
7. Rejection changes the request to `REJECTED`; no ticket is issued and no payment is taken.

### Venue map flow

1. The organizer opens an event and first designs the venue by adding furniture, rows and decorative objects to the canvas.
2. Every object receives a label, position, dimensions and rotation; sellable furniture also receives a chair count.
3. Ticket types and prices are created centrally. Each type also receives a map color.
4. In the separate `Assign tickets` mode, the organizer chooses a whole object, individual chairs or a contiguous seat range and assigns an existing ticket type. No price is re-entered in the map.
5. Rows can contain several ticket categories at once; the organizer and buyer maps color every chair and show a price legend.
6. `WHOLE_TABLE` sells and locks the full table or sofa in one atomic checkout operation.
7. `PER_SEAT` creates a persistent opaque record for every chair; one order may contain selected seats from different price categories.
8. Approval-required requests do not reserve chairs until approval. Approval claims the chosen chairs and opens the payment window.
9. Instant checkout claims the full object or selected chairs and issues the correct number of tickets.
10. A second request for an already claimed chair or object is rejected server-side.

### Event and ticket setup flow

1. A new event starts as a draft and explicitly chooses `GENERAL_ADMISSION` or `RESERVED_SEATING` behavior through `mapEnabled`.
2. General-admission events sell named ticket types without showing a map.
3. Reserved-seating events open the map designer, then the organizer assigns ticket types to sellable objects.
4. Every ticket type has its own capacity, sales window, per-order limit and visibility foundation.
5. `FIXED` pricing uses one amount throughout the sales window.
6. `SCHEDULED` pricing selects the active server-side price tier by time. The initial workflow creates Early Bird and Regular phases.
7. The admission format cannot be changed after an order exists.

The seeded demonstration contains rectangular and round tables, two sofas, a stage, dance floor and bar using both sales modes.

## Stack

- Next.js 16 App Router, React 19, TypeScript
- Tailwind CSS 4 plus a compact project design system
- Prisma ORM and SQLite for the zero-secret local demo
- Zod validation, QRCode, ZXing camera reader, pdf-lib
- Vitest for critical pure business logic

SQLite was selected only so the prototype runs immediately. Before deployment, change the Prisma datasource to PostgreSQL or Supabase Postgres and use database transactions and constraints appropriate for concurrent sales.

## Structure

```text
prisma/                schema and deterministic seed
public/assets/         local event poster
src/app/               App Router pages and API routes
  office/              primary organizer PWA routes
  admin/               compatibility routes for the organizer back-office
  api/                 checkout, check-in, ticket PDF, admin and upload APIs
  events/              buyer event page
  orders/              confirmation and tickets
  scanner/             mobile entrance control
src/components/        focused client and server UI components
  venue-map-editor     bilingual organizer map builder
  event-purchase       buyer category, object and seat selection
src/lib/               database, validation, formatting and ticket logic
```

## Install and run

```bash
cp .env.example .env
npm install
npm run db:push
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. The customer site is `/`; Atlas Office is `/office`; entrance control is `/office/scanner`.

## Environment variables

| Variable | Local value | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | Prisma database connection |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Canonical application URL |
| `APPLE_WALLET_PASS_TYPE_ID` | Apple Pass Type ID | Pass namespace created in Apple Developer |
| `APPLE_WALLET_TEAM_ID` | Apple Team ID | Signing team |
| `APPLE_WALLET_WEB_SERVICE_URL` | Public HTTPS `/api/wallet` URL | Wallet update service |
| `APPLE_WALLET_SIGNER_CERT_BASE64` | secret | PEM pass certificate encoded as base64 |
| `APPLE_WALLET_SIGNER_KEY_BASE64` | secret | PEM private key encoded as base64 |
| `APPLE_WALLET_SIGNER_KEY_PASSPHRASE` | secret | Optional key passphrase |
| `APPLE_WALLET_WWDR_CERT_BASE64` | secret | Apple WWDR certificate encoded as base64 |

Do not commit `.env` or production secrets.

### Apple Wallet setup and update lifecycle

1. Enroll in the Apple Developer Program and create a Pass Type ID for Atlas.
2. Create its Pass Type certificate, export the certificate and private key as PEM, and download the current Apple WWDR certificate.
3. Store the base64-encoded values only in the hosting secret manager using the variables above.
4. Deploy Atlas on a public HTTPS domain and set `APPLE_WALLET_WEB_SERVICE_URL=https://your-domain/api/wallet`.
5. After payment, the customer taps **Add to Apple Wallet** and confirms Apple’s system sheet. Apple does not permit silent installation without this explicit confirmation.
6. Wallet registers the device through the included PassKit endpoints. When the organizer changes event information, Atlas versions every affected pass and sends an empty APNs pass-update notification to registered devices.
7. Wallet requests the changed serial numbers and downloads a newly signed pass with the same serial number and authentication token. Date, venue and status then update on the phone.

The GitHub Pages preview cannot issue a real pass because it has no secure server or certificates. Local/Vercel Wallet download remains hidden until all required Apple secrets are configured.

## Demo identities

Authentication is intentionally simulated. These seeded identities document the intended roles but are not passwords or secure accounts:

- Owner: `organizer@atlas.test` — every organization permission
- Event manager: `manager@atlas.test` — events, tickets, orders and analytics
- Guest approver: `approver@atlas.test` — ticket requests and order viewing
- Door staff: `scanner@atlas.test` — event viewing and check-in only
- Platform admin: `admin@atlas.test`
- Demo buyer: `buyer@atlas.test`

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

For the full manual flow, seed the database, open the venue map, buy individual chairs and a whole table/sofa, download the PDFs, scan a QR at `/scanner`, and scan it again to confirm the duplicate state. The seed also creates one cancelled ticket for rejection testing.

## Deployment

The code is shaped for Vercel, but the local SQLite database and filesystem poster uploads are not suitable for Vercel production. Before deploying:

1. Provision PostgreSQL or Supabase and update the Prisma datasource.
2. Set `DATABASE_URL` in the hosting environment.
3. Replace filesystem uploads with object storage.
4. Run Prisma migrations and seed only intended demo data.
5. Add real authentication and authorization before exposing `/admin`, `/scanner`, or admin APIs.

## Demonstration-only or incomplete

- Test checkout marks orders paid without a payment provider.
- Approval-mode payment is simulated; production must send a secure expiring payment link and release expired holds automatically.
- Demo identity switching uses an HTTP-only cookie but is not secure production authentication. Critical organizer APIs do enforce organization, permission and event scope server-side.
- Apple Wallet code is complete but real signing and device push updates require an Apple Developer account, production Pass Type certificate, public HTTPS deployment and on-device testing.
- Apple requires the customer to confirm adding a pass; Atlas can present the pass immediately after purchase but cannot silently insert it into Wallet.
- Promo and referral support is intentionally minimal.
- Scheduled pricing is time-based. Automatic demand-based price changes are intentionally not enabled until audit logs, notification rules and organizer safeguards are designed.
- The graphical editor supports furniture, straight chair rows and key decorative objects. Curved rows, free-form walls, multi-selection, imported CAD plans and version migration after sales open are intentionally outside this MVP.
- Russian/Hebrew switching is implemented for navigation and the primary purchase, checkout and map-management flows. Remaining secondary back-office copy still needs full translation coverage before production.
- SQLite provides a credible local transaction demo, not production concurrency guarantees.
- Camera scanning depends on browser permission and HTTPS outside localhost.
- No email, WhatsApp, refunds, tax invoices, settlement or organizer payouts.

## Required before real sales

Real acquiring and webhook verification, production authentication, PostgreSQL reservation transactions, expiring seat holds, refunds, fiscal documents, object storage, notifications, backups, monitoring, security review, rate limiting, load tests and a reliable offline scanner mode.

## Recommended next stage

Move persistence to PostgreSQL and implement authenticated organizations plus expiring seat reservations. Only after those foundations are tested should a real payment provider be connected.
