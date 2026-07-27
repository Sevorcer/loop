# Security Lite Allowlists (Temporary)

Security-lite is **blocking by default** for new findings:

- Semgrep findings not listed in `semgrep-allowlist.txt` fail CI.
- `npm audit` high/critical findings not listed in `npm-audit-allowlist.json` fail CI.

Use allowlists only for temporary legacy exceptions that are:

1. Confirmed non-exploitable in LOOP's current deployment model, or
2. Blocked by an upstream package fix that is not safely adoptable yet.

For each allowlist entry, open a follow-up ticket with:

- advisory/check reference
- risk rationale
- remediation owner
- target removal date

See `/home/runner/work/loop/loop/docs/runbooks/security-lite-policy.md` for triage and exception policy.
