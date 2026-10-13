# Easy Barn Ops v2

Clean rebuild of the Easy Barn operations portal. Same Supabase database as the old portal.

## Run it locally

```
npm install
npm run dev        # http://localhost:3001
```

Settings live in `.env.local` (see `.env.example` for the full list).

## Deploy (Vercel)

1. Push this folder to GitHub (repo `easybarn/ops-portal-v2`).
2. Vercel → Add New → Project → import the repo. Framework: Next.js, no build settings to change.
3. Add every variable from `.env.example` under Settings → Environment Variables, then Deploy.
4. Point the live domain at this project; give the old project a fallback address and set `NEXT_PUBLIC_LEGACY_URL` to it.
5. Supabase → Authentication → URL Configuration: set Site URL to the live domain.

## Process

Shopify orders: New (auto PO) → PO raised → picking slip → ready to ship → shipped.
POs are emailed to Panel & Pane from Purchase orders → Send queue.
