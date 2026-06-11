# FM Media

Fast full-stack real estate photography service website built with Next.js App Router, Tailwind CSS, Prisma, and PostgreSQL.

## Architecture

- `Home`, `Services`, `Pricing`, and `Portfolio` are static-first server pages with ISR.
- `About` is fully static.
- `Contact` uses a small client form for submission state and saves inquiries through a server action.
- `/api/inquiries` also accepts JSON booking requests for integrations.
- `Admin` is dynamic and handles CRUD for services and gallery images plus inquiry review.
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

Set `DATABASE_URL` in `.env` before running migrations. For local development, use a hosted Postgres database such as Neon, Supabase, Prisma Postgres, or Vercel Postgres.

Open `http://localhost:3000`.

The local admin login is at `http://localhost:3000/admin/login`.
The default development password is `change-me`; set `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` before deploying.

## Production Notes

- Set `DATABASE_URL` in Vercel to a hosted PostgreSQL connection string.
- Set `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL`, `EMAIL_FROM`, `EMAIL_TO`, and `EMAIL_API_KEY` in Vercel.
- Replace the simple password gate with a full auth provider if multiple admins need accounts or audit history.
- Run production migrations with `npm run prisma:deploy`.
- Seed packages and gallery records with `npm run prisma:seed`.

Email notifications use the Resend HTTP API. `EMAIL_API_KEY` should be a Resend API key, `EMAIL_FROM` should be a verified sender, and `EMAIL_TO` should be the business owner's booking inbox.
