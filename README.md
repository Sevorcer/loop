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
