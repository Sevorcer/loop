# Security-Lite Gate Policy (S5.4)

## Current policy

Security-lite is now **soft-block with allowlist**:

- **Default behavior:** new findings fail CI.
- **Temporary exceptions:** legacy findings can be allowlisted with explicit justification and follow-up tracking.

This keeps findings visible while preventing regression.

## Triage flow

1. Classify finding scope:
   - production runtime dependency vs dev-only
   - reachable/exploitable in LOOP deployment model vs low practical risk
2. Prioritize:
   - high/critical runtime findings first
   - CI/workflow security issues second
   - dev-only debt third
3. Decide action:
   - remediate immediately, or
   - add temporary allowlist entry with follow-up ticket

## Temporary exception rules

An exception is allowed only when all are true:

1. A safe immediate fix is unavailable or would require disruptive change outside current slice.
2. Compensating controls exist (for example: non-runtime path, non-production execution, or constrained attack surface).
3. A follow-up ticket is created with owner and target removal date.

Required metadata for each exception:

- reference (Semgrep check ID or advisory ID)
- package/path
- rationale
- owner
- target removal date

## Enforcement target

- Start date: **2026-07-27**
- Temporary exception sunset target: **2026-08-24**
- Goal on sunset date: empty allowlists and full blocking with no exceptions.
