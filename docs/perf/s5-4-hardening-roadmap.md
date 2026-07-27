# S5 Hardening Roadmap Update (Post S5.3 Merge)

Date: 2026-07-27

## Status updates

- **S5.2**: COMPLETE
- **S5.3**: COMPLETE
- **S5.4**: IN PROGRESS

## S5.4 subtracks

### S5.4a — Dependencies

- Owner: `@owner-tbd`
- Milestone target: **2026-08-10**

Acceptance criteria:

1. High-severity production dependency findings are reduced using safe targeted upgrades.
2. Runtime dependency risk is documented by package/advisory with before/after counts.
3. Any required breaking upgrade is split to a separate PR slice with migration notes.

Exit criteria:

1. `npm audit --omit=dev --audit-level=high` passes or has documented temporary allowlist entries with follow-up tickets.
2. Validation commands pass (`npm run lint`, `npm run build`, `npx vitest run`).

### S5.4b — CI/Workflow Hardening

- Owner: `@owner-tbd`
- Milestone target: **2026-08-10**

Acceptance criteria:

1. Flagged third-party GitHub Actions are pinned to full commit SHAs.
2. Risky expression interpolation inside `run:` blocks is removed by env mapping and quoted shell usage.
3. Workflow behavior remains functionally unchanged.

Exit criteria:

1. Workflow YAML validation passes.
2. Semgrep workflow hardening findings are reduced with explicit delta summary.

### S5.4c — Gate Policy Re-enforcement

- Owner: `@owner-tbd`
- Milestone target: **2026-08-24**

Acceptance criteria:

1. Security-lite is blocking by default for new findings.
2. Legacy findings are managed through documented temporary allowlists.
3. Triage/exception/removal policy is documented and linked from ops docs.

Exit criteria:

1. Security-lite output includes clear distinction between new vs allowlisted findings.
2. Every allowlist entry has a follow-up ticket and target removal date.
3. Exceptions are removed by the milestone target or re-approved with explicit risk sign-off.
