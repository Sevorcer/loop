# Brief for Claude — B8 (expanded): drag-to-reschedule

**This is the B8 item, expanded by Collin's decisions 2026-11-03 — it is STARTED, not parked.** Scope = the dispatch-drag fix PLUS month-calendar drag, per below.

From Zoinks. Two Collin decisions behind this brief (2026-11-03):
1. **The month calendar gets drag-to-reschedule too** — not just the dispatch board.
2. **Overlaps: let it land.** Dropping a job onto a busy day is allowed; no blocking confirmation or hard stop. (Existing overlap/conflict indicators may keep displaying — they're informational.)

## The bug (B8, dispatch board)

Dragging a job on the dispatch board pins BOTH its start and end to the drop date, collapsing a multi-day job to a single day. Any drag-reschedule must instead **shift**: compute the day delta between the job's current start day and the drop day, then move start AND end by that same delta, preserving the job's length and its start/end times of day.

## Scope — one PR per surface is fine, or one PR if they share cleanly

### 1. Dispatch board drag (fix)
- Replace the pin-both-dates behavior with the shift behavior above.
- Day math in the company timezone (America/Los_Angeles), consistent with how the B1 final-day rule and dispatch windowing already count calendar days.

### 2. Month calendar drag (new)
- Jobs on the month view become draggable. Dropping a job on another day reschedules it with the same shift semantics: grabbing any day of a multi-day job's span and dropping shifts the whole job by the grab-to-drop day delta; length and times of day preserved.
- Use the same underlying reschedule mechanism the dispatch board uses (the dispatch-plan reschedule / job schedule update path) — do not build a parallel write path, so dispatch plans and the job stay in sync.
- Respect existing permissions: only roles that can already reschedule a job get an active drag. Completed and cancelled jobs are not draggable.
- Keep a plain click on a job doing what it does today (open/navigate) — drag and click must not fight; a drag is a press-move-release, a click without movement stays a click.

### Both surfaces
- Overlaps land without a blocking dialog. If a conflict indicator already exists for the destination, it may show as it does today.
- After a drop, the view reflects the new dates without a manual refresh.
- Tests: unit tests for the shift math (single-day job, multi-day job, crossing a month boundary, drop on the same day = no-op), plus coverage that the calendar drag calls the same reschedule path. No migrations expected — say so if you find otherwise.

## Guardrails (standing)
- One PR per task; do not merge; do not apply migrations.
- Zoinks runs `npm test` and reviews before anything goes to Collin for a merge decision.
- If the calendar and dispatch drag turn out to share a reschedule handler, prefer fixing it once in the shared place over duplicating the shift logic.
