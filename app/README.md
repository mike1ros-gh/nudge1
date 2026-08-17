# app/

Next.js App Router: pages, layouts, and API routes.

- `app/page.tsx` — the public marketing/landing page.
- `app/(dashboard)/` — the logged-in product (Campaigns, Statistics, Settings, etc.), gated by `app/(dashboard)/layout.tsx`.
- `app/api/` — all backend routes: REST endpoints the frontend calls, the Instagram OAuth callback, the Meta webhook receiver, and cron jobs.
