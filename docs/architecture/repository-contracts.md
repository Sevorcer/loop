# Repository Contracts

This document standardizes repository interfaces used by LOOP services.

## Goals

- Keep CRUD/query contracts consistent across domains.
- Keep transport logic (route handlers) separate from data access.
- Keep Supabase access out of UI/component modules.

## Shared Contracts

All domain repositories should use the shared contracts in `src/lib/repositories/contracts.ts`:

- `RepositoryResult<T, Code>` for success/error result typing.
- `RepositoryError<Code>` for typed error codes and messages.
- `RepositoryQuery<FilterField, SortField>` for list queries.
- `PaginatedResult<T>` for list response shape.
- `CrudRepository<...>` for consistent CRUD signatures.

## List Query Contract

Use a single `RepositoryQuery` object:

- `pagination`: `{ page, pageSize }`
- `filters`: typed field-to-value map
- `sort`: ordered list of `{ field, direction }`

Use `normalizePagination`, `applySort`, and `isFilterMatch` helpers to avoid per-domain ad-hoc behavior.

## Error Contract

Repositories return typed errors rather than throwing for expected domain failures.

Recommended error codes:

- `INVALID_INPUT`
- `NOT_FOUND`
- `CONFLICT`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `UNAVAILABLE`

API routes should translate repository errors via `src/lib/repositories/http.ts`.

## Service Layer Contract

Route handlers should call service functions, and services should depend on repository interfaces.

Flow:

1. API route validates request and authorization.
2. API route calls service method.
3. Service calls repository interface.
4. API route serializes `RepositoryResult`.

## Supabase Access Guardrail

UI/component files must not import Supabase clients directly.

- Allowed: `src/lib/**`, `src/services/**`, API route handlers.
- Disallowed: `src/components/**/*.tsx`, `src/features/**/*.tsx`, `src/app/**/*.tsx`.

This is enforced with ESLint restricted-import rules.
