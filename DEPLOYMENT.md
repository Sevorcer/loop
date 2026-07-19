# LOOP — Vercel Private Staging Deployment

This document covers deploying LOOP as a **private staging environment** on Vercel.

---

## Overview

LOOP is deployed as a **Next.js App Router** application.

The staging environment uses:
- real hosting on Vercel
- platform-level access protection (Vercel Password Protection or Deployment Protection)
- demo/mock data (no production database required)
- the `NEXT_PUBLIC_APP_ENV=staging` flag to display the in-app staging badge

---

## Prerequisites

- Vercel account (free tier is sufficient for staging)
- Repository connected to Vercel
- Node.js 18+

---

## Deploy to Vercel

### 1. Connect the repository

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the `Sevorcer/loop` repository
3. Vercel will auto-detect Next.js — no build config changes needed

### 2. Set environment variables

In Vercel → Project → Settings → Environment Variables, add:

| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_APP_ENV` | `staging` | Displays the "Staging Preview" badge in-app |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Required if Supabase is used |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` | Required if Supabase is used |

> **Note:** If the app currently uses only mock/demo data, the Supabase variables are optional but should still be set to valid (even empty project) values to avoid runtime errors.

### 3. Configure deployment protection

To keep the staging deployment private:

**Option A — Vercel Password Protection** (recommended for simplest setup)
- Vercel → Project → Settings → Deployment Protection
- Enable **Password Protection**
- Set a shared password for internal access

**Option B — Vercel Access Groups**
- Invite specific team members to the Vercel project
- Only authenticated Vercel team members can view the deployment

**Option C — Custom Auth**
- The app ships with an application-level auth layer
- Use this as the primary access control mechanism

### 4. Deploy

Push to the main branch — Vercel will automatically build and deploy.

```bash
git push origin main
```

Or trigger manually via Vercel dashboard → Deployments → Redeploy.

---

## Build Verification

Before deploying, verify the build passes locally:

```bash
npm install
npm run lint
npm run build
```

All 17 routes should build successfully.

---

## Staging Indicator

When `NEXT_PUBLIC_APP_ENV=staging` is set, LOOP displays an amber **"Staging Preview"** badge in the application header. This ensures internal reviewers always know they are on a staging environment rather than a production deployment.

To disable the badge (for production), either:
- Remove `NEXT_PUBLIC_APP_ENV` from environment variables
- Set it to `production`

---

## Known Staging Limitations

The following areas use mock/demo data and are non-blocking for staging:

| Area | Status | Notes |
|------|--------|-------|
| All operational screens | ✅ Functional | Mock data renders correctly |
| Jobs, Properties, Customers | ✅ Functional | Demo records included |
| Dispatch, Inventory, Daily Plans | ✅ Functional | Derived from mock operational events |
| Company Brain | ✅ Functional | Mock knowledge base |
| Search (header) | ⚠️ Not yet implemented | Button present, no action |
| Notifications (header) | ⚠️ Not yet implemented | Button present, no action |

These limitations are expected for a private staging environment.

---

## Domain

For staging, use either:
- Vercel's default `*.vercel.app` domain (simplest)
- A custom subdomain like `staging.yourdomain.com` → add in Vercel → Project → Settings → Domains

---

## After Deployment

1. Open the staging URL in your browser
2. Verify the **Staging Preview** badge appears in the header
3. Smoke test the main navigation flows:
   - Dashboard
   - Jobs list and detail
   - Properties list
   - Customers list
   - Daily Plans
   - Dispatch
   - Live Operations
4. Confirm no critical routes crash
5. Share the URL with internal stakeholders

---

## Updating the Staging Deployment

Push to the connected branch — Vercel redeploys automatically.

For environment variable changes, update in Vercel dashboard and trigger a redeploy.
