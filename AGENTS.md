# LOOP Engineering Guide
Version: 1.0

---

# Mission

You are contributing to **LOOP**.

LOOP is the Operating System for Field Operations.

LOOP is built for HVAC and field service companies and is designed to become the primary platform owners, office staff, installers, technicians, and sales teams use every day.

Every engineering decision should improve:

• Simplicity
• Speed
• Reliability
• Maintainability
• User Experience

Always optimize for long-term maintainability over short-term convenience.

---

# Product Philosophy

LOOP is NOT another CRUD application.

It is an operations platform.

Every screen should answer one question:

> What does the user need to know right now?

Information should drive action.

Never overwhelm users with unnecessary data.

Whitespace is a feature.

Hierarchy is more important than decoration.

---

# Core Design Principles

LOOP should feel:

• Calm
• Professional
• Fast
• Trustworthy
• Information First
• Modern

Take inspiration from products like:

- Linear
- Stripe
- Vercel
- Notion

Do NOT copy them.

Build a unique identity.

---

# Technology Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Supabase
- Lucide Icons
- Vercel

---

# Architecture Philosophy

Build platforms.

Not pages.

Pages assemble features.

Features assemble reusable components.

Components assemble primitives.

Business logic stays separate from presentation.

---

# React Philosophy

## Server Components First

Default every component to a Server Component.

Only use:

"use client"

when absolutely required.

Examples:

✓ useState

✓ useEffect

✓ useRef

✓ usePathname

✓ useRouter

✓ Browser APIs

✓ Local Storage

✓ Client-only libraries

Never add "use client" simply to resolve build errors.

Find the actual architectural cause.

Server by default.

Client by necessity.

---

# Interaction Philosophy

Prefer CSS.

Not JavaScript.

For hover effects use:

hover:

group-hover:

focus-visible:

transition-all

transition-colors

transition-transform

Avoid:

onMouseEnter

onMouseLeave

unless real application logic requires JavaScript.

---

# Folder Structure

src/

app/

components/

features/

lib/

services/

hooks/

types/

---

# Application Layer

src/app

Contains routing only.

Every page.tsx should remain extremely small.

Example:

```tsx
import { DashboardScreen } from "@/features/dashboard";

export default function DashboardPage() {
    return <DashboardScreen />;
}
```

Never place business logic inside page.tsx.

---

# Feature Layer

src/features

Each feature owns itself.

Examples:

dashboard

jobs

properties

company-brain

daily-plans

settings

Feature folders contain:

- Screens
- Feature Components
- Feature Hooks
- Feature Utilities

Business logic never crosses feature boundaries.

---

# Components

Every component belongs to exactly one layer.

---

## UI Layer

src/components/ui

Contains primitive components.

Examples:

Button

Card

Input

Dialog

Dropdown

Checkbox

Sheet

No business logic.

No feature awareness.

---

## ATLAS Layer

src/components/atlas

Contains reusable LOOP components.

Examples:

PageHeader

KPICard

SectionCard

StatusBadge

EmptyState

LoadingState

Timeline

MetricTrend

StatRow

If multiple features can use it,

it belongs here.

---

## Layout Layer

src/components/layout

Contains:

AppShell

Sidebar

Header

Navigation

Only application structure.

Never business logic.

---

# Component Decision Tree

Before creating a component ask:

Is it a primitive?

→ ui

Is it reusable?

→ atlas

Is it layout?

→ layout

Is it feature specific?

→ features

---

# Routing

Never hardcode routes.

Use:

src/lib/routes.ts

Always use:

Link

usePathname()

App Router conventions.

---

# Business Logic

Business logic belongs inside:

features/

or

services/

Never inside:

page.tsx

Never inside:

layout

Never inside:

ATLAS

Never inside:

UI primitives

---

# Styling

Prefer:

Tailwind

shadcn/ui

ATLAS

Avoid:

Inline styles

Hardcoded colors

Custom CSS

unless absolutely necessary.

---

# ATLAS Design Language

ATLAS defines:

Colors

Typography

Spacing

Elevation

Radius

Motion

Icons

Hierarchy

Interaction

Accessibility

Every UI decision should reinforce ATLAS.

---

# Theme

Dark-first.

Avoid pure black.

Use layered surfaces.

Maintain comfortable contrast.

Design for professionals using the software all day.

---

# Design Tokens

Color values belong ONLY inside:

globals.css

Never hardcode colors inside components.

Never write:

bg-slate-900

text-gray-500

#111827

inside reusable components.

Components consume semantic tokens only.

Examples:

background

surface

surface-elevated

border

text-primary

text-muted

primary

success

warning

danger

---

# Typography

Maintain consistent hierarchy.

Display

PageTitle

SectionTitle

CardTitle

Body

Caption

Metric

Metric values should always dominate visually.

---

# Cards

Cards should feel light.

Requirements:

- subtle elevation
- soft shadows
- generous spacing
- consistent radius
- smooth hover transitions

---

# Buttons

Primary actions stand out.

Secondary actions stay quiet.

Quick Actions should resemble launch tiles.

Not form buttons.

---

# Layout Philosophy

Whitespace is a feature.

Avoid unnecessary borders.

Avoid unnecessary separators.

Keep interfaces calm.

---

# Performance

Minimize client-side JavaScript.

Prefer server rendering.

Lazy load expensive components.

Optimize images.

Avoid unnecessary re-renders.

---

# Accessibility

Support:

Keyboard navigation

Focus states

Proper contrast

Semantic HTML

Accessible labels

---

# Documentation

Architecture

docs/

Sprint Specifications

planning/Sprints/

Design System

docs/atlas.md

Major decisions

docs/

---

# Sprint Workflow

Every sprint follows this process.

1.

Read AGENTS.md

2.

Read Sprint Specification

3.

Create implementation plan

4.

Explain:

Files created

Files modified

Architecture decisions

5.

WAIT FOR APPROVAL

6.

Implement

7.

Run:

npm run build

8.

Verify:

✓ Build succeeds

✓ TypeScript passes

✓ No lint errors

9.

Summarize every modified file.

Never skip planning.

---

# Code Review Checklist

Before work is complete verify:

✓ Builds successfully

✓ TypeScript passes

✓ Architecture respected

✓ Server Components preferred

✓ No unnecessary Client Components

✓ Components reusable

✓ No duplicated logic

✓ No hardcoded colors

✓ Responsive layout maintained

✓ Accessibility preserved

✓ Design follows ATLAS

---

# Git

One logical change per commit.

Commit prefixes:

feat:

fix:

refactor:

style:

docs:

test:

chore:

---

# AI Workflow

Never immediately edit files.

Always:

Understand the architecture.

Read AGENTS.md.

Read the Sprint Specification.

Create an implementation plan.

Explain architectural decisions.

Wait for approval.

Implement.

Run build verification.

Summarize changes.

If a better architectural solution exists,

recommend it before writing code.

Protect the architecture.

Do not simply satisfy the prompt.

Think like a senior software engineer.

---

# Final Rule

Before writing code ask:

Will this still be the correct solution two years from now?

If not,

design a better one.

Protect the architecture.

Always.