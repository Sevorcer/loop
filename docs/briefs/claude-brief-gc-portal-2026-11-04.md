# Brief for Claude — GC-facing portal (decisions locked, Collin 2026-11-04)

From Zoinks. The internal GC money layer is live (contacts, ledger, GC Overview). This brief is the GC-facing side. LOOP already has a customer project portal (timeline, photos, documents, GC issue intake) — this extends that shell; do not build a parallel portal. One PR per task, do not merge, do not apply migrations, `npm run build` + full suite green before reporting ready. Questions on issue #337.

## Collin's four decisions
1. **All builders** get access — strictly scoped: a builder sees ONLY their own properties/jobs.
2. They can see **everything** — progress, photos, documents, AND money — but **money visibility is toggleable per job** (office controls the toggle on each job).
3. Access is by **per-job share link** (no GC logins).
4. GCs can **submit issues/requests** through the link.

## Task 1 — Share-link access + scoping
- Each job gets a shareable portal link: an unguessable token (stored hashed), issued/revoked by office-and-above from the job page. Revoking kills the link immediately.
- The link resolves to ONE job's portal view. Data access must be scoped server-side to that job and its property/customer — a token for job A must return nothing about job B, including via API probing (IDs in URLs are not authorization; the token's job scope is).
- The builder's other jobs are NOT reachable from a job link (per-job, per Collin's call — not per-builder).
- Tests: valid token renders its job; revoked token 404s; token A cannot fetch job B's photos/documents/ledger by any route the portal uses.

## Task 2 — Portal view: progress + photos + documents
- Reuse the existing portal shell: job timeline/status, photos, documents for that job.
- Show the assigned crew and scheduled dates in plain language (no internal notes, no tech personal data beyond first names already shown in-app — if in doubt, flag on #337).
- No LOOP chrome/sidebar; the page is the GC's whole world.

## Task 3 — Money section behind a per-job toggle
- New per-job flag (migration — write it, don't apply): `portal_money_visible`, default **false**; office-and-above flips it from the job page (near the share-link controls).
- When ON, the portal shows that job's money picture from the GC ledger + bid/invoice fields: price, change orders, invoice # and dates sent/received, balance, retainer held. Read-only.
- When OFF, the money section is entirely absent (not greyed out) and the underlying API returns none of those fields.
- Tests: toggle off → no money fields in any portal response; toggle on → figures match the internal ledger for that job.

## Task 4 — Issue/request submission
- The portal's existing GC issue intake becomes live for share-link visitors: a simple form (name, contact, message) that lands in LOOP as an item the office sees (use the existing intake storage if it exists; if it's a stub, build the smallest real version and say so).
- Submissions are stamped with the job from the token — a GC cannot submit against another job.
- Office visibility: submissions appear on the job (timeline or a portal-submissions section) — keep it to one obvious place.
- Basic abuse hygiene: submissions require the valid token; add the same rate limit the batch's hardening PR introduces if it lands first, else a simple per-token cap.

## Out of scope
GC logins/accounts, per-builder (multi-job) links, payments, invoice sending, QuickBooks anything, email notifications to GCs (no outbound sending layer exists yet — that's the parked comms decision).
