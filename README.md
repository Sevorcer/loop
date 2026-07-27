# LOOP — Field Operations Platform

LOOP is the operating system for field service companies — managing jobs, dispatch, properties, inventory, customers, and more.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install dependencies

```bash
npm install
```

### Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

### Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run smoke:write-path` | Run write-path smoke harness |
| `npm run load:write-path` | Run write-path load harness |
| `npm run db:seed` | Apply deterministic baseline + golden-path DB fixtures |
| `npm run db:reset` | Remove deterministic seeded records (non-prod guarded) |
| `npm run db:reseed` | Reset then re-apply deterministic fixtures |

---

## Temporary Security Checks

The following automated checks run in CI on every PR and push to `main`, plus weekly:

- **Semgrep** — runs locally in CI with no token required, scanning against `p/javascript`, `p/typescript`, `p/nodejs`, and `p/owasp-top-ten` rulesets. Any finding fails the build.
- **npm audit** — checks production dependencies (`--omit=dev`) at `--audit-level=high`.

These checks are temporary until native GitHub code scanning (CodeQL) is fully available for this repository. No `SEMGREP_APP_TOKEN` or other external secrets are required.

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel private staging setup.

---

## Tech Stack

- **Next.js** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui**
- **Supabase**
- **Lucide Icons**
- **Vercel**
