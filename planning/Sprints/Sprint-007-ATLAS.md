\# Sprint 007 — ATLAS Design Language v1



\## Objective



Establish the ATLAS design language for LOOP.



This sprint is focused entirely on visual identity, consistency, and user experience.



No new business features should be added.



\---



\## Vision



LOOP should feel like the operating center for a modern field service company.



Design goals:



\- Calm

\- Fast

\- Professional

\- Information First

\- Dark by default

\- Minimal distractions



Take inspiration from products like Linear, Vercel, and Stripe, but create a unique identity for LOOP.



\---



\## Theme



Implement a dark-first theme.



Use CSS variables so the design system is centralized.



Suggested palette:



Background:

\#0B1220



Surface:

\#111827



Elevated Surface:

\#1F2937



Border:

\#374151



Primary Text:

\#F9FAFB



Muted Text:

\#9CA3AF



Primary Accent:

\#3B82F6



Success:

\#22C55E



Warning:

\#F59E0B



Danger:

\#EF4444



Avoid pure black.



\---



\## Typography



Create clear hierarchy.



Page Title:

Large

Bold



Section Titles:

Medium

Semibold



Body:

Readable

Muted where appropriate.



KPI values should be visually dominant.



\---



\## Cards



Refine the Card component.



Requirements:



\- subtle borders

\- elevated appearance

\- consistent padding

\- rounded corners

\- soft shadows

\- hover transition



\---



\## Buttons



Primary actions should stand out.



Secondary actions should remain subtle.



Quick Action buttons should feel like launch tiles instead of form buttons.



\---



\## Sidebar



Create a premium navigation experience.



Requirements:



\- dark surface

\- active item highlight

\- hover transitions

\- improved spacing

\- stronger branding section



\---



\## Header



Reduce visual weight.



Keep it clean.



Prioritize search and notifications.



\---



\## KPI Cards



Improve hierarchy.



Display:



Large value



Smaller title



Optional trend placeholder



Prepare component for future trends.



\---



\## Page Header



Refine spacing and typography.



Greeting should become the visual focus.



Example:



Good Morning, Collin



Everything is running smoothly today.



\---



\## Recent Activity



Increase readability.



Improve spacing.



Improve icon treatment.



Cards should feel scannable.



\---



\## Requirements



Follow AGENTS.md.



Keep components reusable.



No business logic.



No Supabase.



No fake APIs.



Keep page.tsx files minimal.



Run npm run build before finishing.



\---



\## Acceptance Criteria



✓ Dark theme implemented



✓ Design system feels cohesive



✓ Dashboard looks production-ready



✓ Components remain reusable



✓ Project builds successfully



✓ No TypeScript errors

