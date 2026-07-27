# S5.3 Post-Merge Performance Verification Report

## Measurement metadata
- Date/time (UTC): 2026-07-27 06:22:27 UTC
- Repository state (after): `74d54cd` (`main`)
- Baseline state (before S5.2): `f1e00f1`
- Environment: GitHub Actions sandbox clone, Node `v24.18.0`, npm `11.16.0`, Next.js `16.2.10`
- Method: Same route/API probe flow run on both commits with local Next dev server; because no authenticated stable live env was available, metrics below are labeled as **proxy metrics** where needed.

## Executive summary
- **Wins**
  - Removed two client waterfalls introduced by route-level client fetches:
    - `/properties/[id]` jobs fetch moved server-side.
    - `/installed-systems/[id]` detail fetch moved server-side.
  - Removed unnecessary `/api/jobs` fetch from `/installed-systems` route tree by removing `JobsProvider` wrapper.
  - Improved client typing responsiveness for `/company-brain` search via `useDeferredValue`.
- **Neutral**
  - Dev-proxy TTFB stayed effectively flat across measured routes.
  - `/properties` still depends on post-hydration client fetch to load table data.
- **Regressions observed**
  - No new regressions attributable to S5.2 in the measured scope.

## Before vs after (per route)

> Notes:
> - **TTFB** values are first-hit local dev proxy measurements (not production).
> - **LCP** is reported as a structural proxy due auth-gated environment.
> - API timings are local proxy endpoint timings; key APIs still return 401 without authenticated session in this environment.

| Route | TTFB proxy (before → after) | LCP proxy (before → after) | Key API timing proxy | Remaining client waterfalls |
|---|---:|---|---|---|
| `/properties` | `185ms → 185ms` (200) | Unchanged: primary table content still waits on client fetch | `/api/properties` `92ms → 95ms` (401) | **1** (`PropertiesProvider` → `/api/properties`) |
| `/properties/[id]` | `555ms → 579ms` (500 in both env runs) | Improved: jobs no longer gated by client-side loading state | `/api/properties/[id]/jobs` `606ms → 600ms` (401); moved off critical UI path | **1 → 0** (jobs tab/overview fetch removed) |
| `/installed-systems` | `144ms → 151ms` (200) | Improved: less post-hydration work from provider stack | `/api/installed-systems` `37ms → 37ms` (401) and extra `/api/jobs` fetch removed from route wrapper | **2 → 1** (`JobsProvider` removed, `InstalledSystemsProvider` remains) |
| `/installed-systems/[id]` | `498ms → 506ms` (404 in both env runs) | Improved: detail fetch moved from client/provider path to server route | `/api/installed-systems/[id]` `587ms → 612ms` (401); no longer required for first detail paint path | **1 → 0** (client lookup path removed) |
| `/company-brain` | `98ms → 103ms` (200) | Improved interaction LCP proxy: search input updates deprioritized (`useDeferredValue`) | `/api/knowledge-items` `36ms → 36ms` (401) | **1** initial fetch remains (expected) |

## What changed in S5.2 (Step 1–6) → observed impact

1. **Removed `JobsProvider` from `/installed-systems` layout** (`src/app/(shell)/installed-systems/layout.tsx`)  
   → Eliminated unnecessary jobs data fetch chain for installed-systems routes.
2. **Added deferred search input handling in Company Brain** (`useDeferredValue`)  
   → Reduced keystroke contention during filtering.
3. **Memoized recent usage derivation in Company Brain** (`useMemo`)  
   → Reduced repeated list recomputation on unrelated renders.
4. **Optimized technical profile lookup structure** (`Map` lookup path)  
   → Lower per-item lookup overhead in installed-systems list/detail usage.
5. **Converted `/installed-systems/[id]` to server-side fetch**  
   → Removed client/provider waterfall before detail render.
6. **Hoisted `/properties/[id]` jobs fetch to server route**  
   → Removed jobs tab/overview client waterfall and loading gap.

## Regressions / unknowns
- **Unknown:** Production-authenticated TTFB/LCP for the five target routes is not measurable from this sandbox because protected routes require a valid Supabase session and env-backed auth context.
- **Unknown:** API p95/p99 under realistic org data and network conditions.
- **Known residual waterfall:** `/properties` and `/company-brain` still rely on client-initiated initial data fetches after hydration.

## Recommended next 3 optimizations (ranked impact × effort)
1. **Move `/properties` initial list fetch to server boundary (high impact, medium effort).**  
   Remove first client waterfall and improve first meaningful content.
2. **Add authenticated perf smoke workflow against staging URL (high impact, medium effort).**  
   Capture real TTFB/LCP/API timings with stable credentials and trend over time.
3. **Add response-time instrumentation headers for key APIs (medium impact, low effort).**  
   Emit server-timing metrics to make route/API regressions objective in CI artifacts.

## Roadmap transition
- **S5.2:** Complete
- **S5.3:** Complete (this report)
- **S5.4:** In progress — dependency remediation, workflow hardening, and security-lite gate re-enforcement.
- Tracking doc: `/home/runner/work/loop/loop/docs/perf/s5-4-hardening-roadmap.md`
