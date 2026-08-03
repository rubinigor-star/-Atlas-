# Atlas deployment safety

## Non-negotiable rules

1. Production deploys only from `main`.
2. Preview deployments must use a separate Preview Supabase database.
3. `ATLAS_DATABASE_ENV=production` is set only for the Vercel Production environment.
4. `ATLAS_DATABASE_ENV=preview` is set only for Vercel Preview. Development may be configured later if local cloud development is required.
5. No seed, showcase, demo, reset, bulk-update, or bulk-delete script may run from `vercel-build`.
6. Database schema changes are executed as an explicit migration step after backup and review, never as a side effect of a web build.
7. Mobile development uses its own branch, Vercel project, and Preview database.
8. Production promotion requires a reviewed pull request, green CI, successful Preview verification, and explicit approval.

## Release flow

1. Create `feature/<name>` from current `main`.
2. Develop only in that branch.
3. Preview deployment uses Preview Supabase.
4. Run lint, typecheck, tests, build, and smoke tests.
5. Review the Preview visually and functionally.
6. Merge by pull request into `main`.
7. Vercel deploys `main` to Production.
8. Verify homepage, event catalog, checkout, HYP callback, order creation, tickets, and scanner.
9. Tag the accepted commit as `production-approved-YYYYMMDD-HHMM`.

## Emergency rollback

- Code rollback: promote the last approved Vercel Production deployment.
- Database rollback: use Supabase scheduled backup or the encrypted external backup.
- Never restore the database before preserving the current state if newer paid orders may exist.

## Environment matrix

| Environment | Git branch | Vercel project | Database | ATLAS_DATABASE_ENV |
|---|---|---|---|---|
| Production | `main` | `atlas-web` | Production Supabase | `production` |
| Preview | `feature/*`, `develop` | `atlas-web` | Preview Supabase | `preview` |
| Mobile | `mobile/*` | `atlas-mobile` | Preview Supabase/API | `preview` |

## Required manual platform settings

### GitHub

- Protect `main`.
- Require pull requests before merging.
- Require at least one approval.
- Require status checks: lint, typecheck, tests, build.
- Block force pushes and branch deletion.

### Vercel

- Production Branch: `main` only.
- Do not manually promote feature or mobile deployments to Production.
- Set separate `DATABASE_URL` values for Production and Preview.
- Set `ATLAS_DATABASE_ENV=production` for Production.
- Set `ATLAS_DATABASE_ENV=preview` for Preview.
- Development environment configuration is optional and does not block Preview deployments.

### Supabase

- Keep scheduled daily backups enabled.
- Maintain a separate Preview project/database.
- Never run seed/reset scripts against Production.
- Back up Storage separately because database backups do not contain Storage objects.

Last environment separation verification trigger: 2026-08-03.
