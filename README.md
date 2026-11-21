# PolicyDesk

A demo-sized clone of the ISi Unified Application for Indian motor insurance: agents log in, quote from a
form that is defined as data in the UA Builder, get a premium from a step-based rating engine, take a
demonstration payment, send documents for e-sign, and issue a policy.

See `IMPLEMENTATION_PLAN.md` for the design.

## Run locally

1. Copy `.env.example` to `.env` and fill it in. `DATABASE_URL` is a Postgres connection string (Neon in
   production). For a throwaway local database run `npx prisma dev -d -n policy` and use the TCP URL it prints.
2. Create the tables and the seed data:

   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```

3. Start the app with `npm run dev` and sign in with the `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `.env`.

With `SMTP_HOST` empty, emails (sign-in codes, set-password links, signing links and codes) are printed in the
server log instead of being sent.

## Checks

| Command | What it does |
|---|---|
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Unit tests for conditions, the page engine and the rating engine |
| `npm run e2e` | Runs a whole quote against the database: vehicles, rating, payment, e-sign, policy issue. Set `KEEP=1` to keep the quote it creates |
| `npm run build` | Production build |

## Deploy (Vercel and Neon)

1. Create a Neon project and copy the pooled connection string.
2. Import the repository in Vercel and set these environment variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`
   (a new random value), `BETTER_AUTH_URL` (the deployed URL, used in emailed links), `SMTP_HOST`, `SMTP_PORT`,
   `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
3. From your machine, with `DATABASE_URL` pointing at Neon, run `npx prisma migrate deploy` and then
   `npx prisma db seed` (with the `SEED_*` variables set).
4. Deploy. Sign in as the seeded administrator, change the password under Account, and create agents under Users.

## Where things are

| Path | What |
|---|---|
| `src/lib/ua` | Condition evaluator, page engine, validation, widget registry, quote pipeline |
| `src/lib/rating` | Rating engine and the seeded private car rate program |
| `src/lib/documents`, `src/lib/esign.ts` | Document templates, PDF rendering, signing, policy issue |
| `src/app/(app)` | Signed-in screens: quotes, policies, UA Builder, Rating, Users, Audit log |
| `src/app/esign` | Public signing pages (no login) |
| `prisma` | Schema, migrations and seed |

Rates, add-on prices and document wordings are illustrative and must be replaced before any real use.
