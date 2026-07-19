\# LOOP Design System



\## Overview



LOOP uses the ATLAS design system as its internal product UI language.



The system should support:



\- phone-first layouts

\- fast scanning

\- operational clarity

\- consistent status communication

\- reusable section composition



\## Core Principles



\### 1. Field-first clarity

Interfaces should be readable at a glance while moving, standing, or working in the field.



\### 2. Strong hierarchy

Important actions, statuses, and next steps must stand out immediately.



\### 3. Reuse over one-off design

If a pattern appears twice, it should be considered for ATLAS extraction.



\### 4. Operational tone

The UI should feel like an operations tool, not a generic CRM.



\## Existing Components



\### ATLAS

\- `PageHeader`

\- `SectionCard`

\- `StatusBadge`

\- `DataTable`



\### Layout

\- `AppShell`

\- `Sidebar`

\- `Header`



\### Base UI

\- shadcn/ui card

\- shadcn/ui button

\- existing utility styling via Tailwind



\## Current Property Detail Patterns



The property detail page currently uses repeatable patterns that are candidates for ATLAS abstraction:



\- tab navigation row

\- metadata cards

\- empty section blocks

\- timeline list

\- photo/document cards

\- split overview layout

\- badge-driven status summaries



\## Recommended Near-Term ATLAS Additions



\### AtlasTabs

Reusable tab switcher for feature detail pages.



\### AtlasEmptyState

Reusable empty state block with:

\- title

\- description

\- optional icon

\- optional action



\### AtlasMetricCard

Reusable compact metric display for summary values.



\### AtlasTimeline

Reusable event timeline with:

\- icon

\- title

\- date

\- description



\### AtlasDocumentCard

Reusable file/document metadata card.



\### AtlasPhotoCard

Reusable field photo card.



\## Status Language



Status styling should remain consistent across features.



\### Success

Use for:

\- operational

\- complete

\- ready

\- active

\- healthy



\### Warning

Use for:

\- pending

\- scheduled

\- needs review

\- required

\- in progress



\### Neutral

Use for:

\- inactive

\- informational

\- unclassified

\- archived-style content



\## Layout Guidance



\- prefer stacked mobile-first layouts

\- avoid dense desktop-only table thinking for detail screens

\- allow horizontal overflow only when it is intentional and touch-friendly

\- keep primary actions near the top of the viewport

\- preserve strong spacing rhythm between sections



\## Current UI Debt to Watch

\- repeated section composition in property detail tabs

\- non-ATLAS placeholders that should become shared empty states

\- tab behavior that may eventually need route/query-state persistence

