# FM Media

Fast full-stack real estate photography service website built with Next.js App Router, Tailwind CSS, Prisma, and PostgreSQL.

## Architecture

- `Home`, `Services`, `Pricing`, and `Portfolio` are static-first server pages with ISR.
- `About` is fully static.
- `Contact` uses a small client form for submission state and saves inquiries through a server action.
- `Admin` is dynamic and handles CRUD for services and gallery images plus inquiry review.
- Admin gallery uploads use Vercel Blob storage and save public image URLs in PostgreSQL.
- Images render through `next/image` with AVIF/WebP support and responsive sizing.

## Data Models

- `GalleryImage`: portfolio image metadata, category, dimensions, publish and featured flags.
- `Service`: service/pricing package copy, slug, price, deliverables, turnaround, publish and featured flags.
- `Inquiry`: validated booking/contact request with property address, shoot type, preferred date, and status.
- `AdminUser`: placeholder model for adding authentication.

## Local Setup

```bash
npm install
npm run prisma:deploy
npm run prisma:seed
npm run dev
```

Set `DATABASE_URL` in `.env` before running migrations. Use a local Postgres (on `localhost`) for development, never the production database. The seed step only runs against a local `DATABASE_URL` and only inserts rows that are missing; `npm test` checks those rules.

Open `http://localhost:3000`.

The local admin login is at `http://localhost:3000/admin/login`.
The default development password is `change-me`. Production refuses weak or placeholder secrets: `ADMIN_PASSWORD` needs 16+ characters, and `ADMIN_SESSION_SECRET` and `RATE_LIMIT_SALT` each need 32+ random characters (see `.env.example`). Admin sessions last 12 hours and are stored in the `AdminSession` table; signing out revokes them.

## Production Notes

- Set `DATABASE_URL` in Vercel to a hosted PostgreSQL connection string.
- Set `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `RATE_LIMIT_SALT`, `NEXT_PUBLIC_SITE_URL`, `EMAIL_FROM`, `EMAIL_TO`, `EMAIL_API_KEY`, and `BLOB_READ_WRITE_TOKEN` in Vercel. `INQUIRY_RETENTION_MONTHS` is optional (default 24).
- Run `npm run prisma:deploy` against production **before** deploying new code that adds a migration.
- Replace the simple password gate with a full auth provider if multiple admins need accounts or audit history.
- Run production migrations with `npm run prisma:deploy`.
- **Never seed production.** `npm run prisma:seed` is for an empty local database only. It is insert-only (it never deletes or overwrites rows) and refuses to run when `NODE_ENV=production` or when `DATABASE_URL` is not a local host (`localhost`, `127.0.0.1`, `::1`). Manage live services and gallery images in `/admin`.

Email notifications use the Resend HTTP API. `EMAIL_API_KEY` should be a Resend API key, `EMAIL_FROM` should be a verified sender, and `EMAIL_TO` should be the business owner's booking inbox.
Gallery file uploads use Vercel Blob. Connect a Blob store to the Vercel project so `BLOB_READ_WRITE_TOKEN` is available before using admin uploads.
