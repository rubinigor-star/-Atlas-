# Atlas Tickets MVP

Atlas is a mobile-first ticketing platform prototype for Israeli live events. It demonstrates one complete vertical flow: an organizer publishes an event, a buyer reserves general admission or a VIP table, completes a test checkout, receives unique QR tickets and PDFs, and door staff validates each ticket once.

> This is an MVP. It does not process real payments and must not be used for commercial ticket sales without the security and infrastructure work listed below.

## What works

- Published event catalog and event details
- Per-event sales mode: instant ticket delivery or organizer approval before payment
- Organizer application queue with approve/reject decisions and applicant eligibility answers
- Approved applications reserve inventory for a 24-hour test-payment window
- Three-panel venue-map builder with a zoomable canvas, object library and property inspector
- Rectangular and round tables, sofas, chair rows, zones, stage, bar and text objects
- Ticket-category assignment for every map object
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
- Event creation/editing, publish controls, categories and VIP tables with local poster upload
- Ticket cancellation and code regeneration
- Minimal promo code (`ATLAS10`) and referral data (`MALINA`)
- Seed event, users and test order

### Approval-required event flow

1. The organizer selects `APPROVAL_REQUIRED` in the event manager and defines the question shown to applicants.
2. The buyer selects a category or table and submits contact and eligibility information without payment.
3. Atlas creates a `PENDING_APPROVAL` request without issuing tickets or reducing inventory.
4. The organizer approves or rejects the request from `/admin/requests`.
5. Approval atomically reserves the inventory/table and opens a 24-hour `AWAITING_PAYMENT` window.
6. The demo payment changes the order to `PAID` and only then creates unique QR tickets and PDFs.
7. Rejection changes the request to `REJECTED`; no ticket is issued and no payment is taken.

### Venue map flow

1. The organizer opens an event and first designs the venue by adding furniture, rows and decorative objects to the canvas.
2. Every object receives a label, position, dimensions and rotation; sellable furniture also receives a chair count.
3. In the separate `Assign tickets` mode, the organizer assigns a category, price and whole-object or per-chair selling rule.
4. `WHOLE_TABLE` sells and locks the full table or sofa in one atomic checkout operation.
5. `PER_SEAT` creates a persistent opaque record for every chair; buyers can select one or more chairs behind the same object.
6. Approval-required requests do not reserve chairs until approval. Approval claims the chosen chairs and opens the payment window.
7. Instant checkout claims the full object or selected chairs and issues the correct number of tickets.
8. A second request for an already claimed chair or object is rejected server-side.

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
  admin/               organizer back-office
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

Open `http://localhost:3000`. Back-office is at `/admin`; entrance control is at `/scanner`.

## Environment variables

| Variable | Local value | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:./dev.db` | Prisma database connection |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Canonical application URL |

Do not commit `.env` or production secrets.

## Demo identities

Authentication is intentionally simulated. These seeded identities document the intended roles but are not passwords or secure accounts:

- Organizer: `organizer@atlas.test`
- Door staff: `scanner@atlas.test`
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
- Roles exist in the schema but routes are not protected.
- Promo and referral support is intentionally minimal.
- The graphical editor supports furniture, straight chair rows and key decorative objects. Curved rows, free-form walls, multi-selection, imported CAD plans and version migration after sales open are intentionally outside this MVP.
- Russian/Hebrew switching is implemented for navigation and the primary purchase, checkout and map-management flows. Remaining secondary back-office copy still needs full translation coverage before production.
- SQLite provides a credible local transaction demo, not production concurrency guarantees.
- Camera scanning depends on browser permission and HTTPS outside localhost.
- No email, WhatsApp, refunds, tax invoices, settlement or organizer payouts.

## Required before real sales

Real acquiring and webhook verification, authentication, strict role-based authorization, PostgreSQL reservation transactions, expiring seat holds, refunds, fiscal documents, object storage, notifications, backups, monitoring, audit logs, security review, rate limiting, load tests and a reliable offline scanner mode.

## Recommended next stage

Move persistence to PostgreSQL and implement authenticated organizations plus expiring seat reservations. Only after those foundations are tested should a real payment provider be connected.
