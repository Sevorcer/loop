# Brief — Allison batch 1b: everyone can reach Appearance / light mode (#42)

**Correction to the earlier triage:** light mode EXISTS and is fully built —
`COLOR_MODES = ["dark", "light"]` in features/settings, persisted per device,
applied app-wide. The problem is access, found by Collin 2026-11-05: Allison
(office) "doesn't have permission to view settings," so she can never reach
the Appearance page where the toggle lives.

Verified mechanics on current main:
- `src/app/(shell)/settings/page.tsx` redirects EVERYONE to
  `/settings/users`.
- Users, Roles, and Feedback pages each gate to owner/manager only and render
  a standalone "not available for your role" wall (no settings nav on it).
- `settings/appearance/page.tsx` has NO gate — but clicking "Settings" lands
  every non-owner/manager on the Users wall, so Appearance is unreachable
  through the UI for office/dispatch/tech.

## Fix
1. **Role-aware settings landing:** `/settings` redirects owner/manager →
   Users (unchanged); every other role → Appearance.
2. **Role-filtered settings nav:** wherever SETTINGS_NAV_ITEMS renders, show
   Users / Roles & Permissions / Feedback only to owner/manager; Appearance
   shows for ALL roles.
3. **No dead ends:** the three "not available for your role" pages should
   render inside the normal settings layout (with the role-filtered nav), so
   anyone who lands there by direct URL can still get to Appearance.
4. Do NOT loosen the actual section gates — Users/Roles/Feedback stay
   owner/manager. This only fixes navigation to the one section everyone is
   allowed to use.

## Rules
- Standard gates: tsc, FULL suite, production build. Update/add tests for the
  redirect + nav filtering (settings nav tests already exist — extend them).
- Fold into the batch 1 PR if it hasn't been cut yet; otherwise its own small
  PR. Prep only — Collin merges. Verify note for the report: an office-role
  sign-in must land on Appearance from the Settings entry point and be able
  to switch color mode to light.
