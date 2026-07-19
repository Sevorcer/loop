# Error-State Catalog — Project Portal

**Version:** 1.0  
**Sprint:** 22  
**Status:** Draft — pending review  
**Last updated:** 2026-07-19

This catalog defines every critical error and empty state the Project Portal must handle gracefully. Each entry specifies the trigger condition, user-facing copy, CTAs, telemetry, severity, recoverability, accessibility notes, and mobile behavior.

The goal is zero surprise failures. Every state the portal can reach must be designed, not improvised.

For freshness SLA and stale-data behavior, see [`event-contract-spec.md`](./event-contract-spec.md#stale-data-behavior).

---

## Error Severity Levels

| Severity | Meaning |
|---|---|
| **Critical** | User cannot proceed. Access is blocked or service is unavailable. |
| **Warning** | User can proceed but with degraded or potentially stale information. |
| **Informational** | User is in a valid state but the view is empty or minimal. |

---

## Catalog

### ES-01 — Unauthorized

| Field | Value |
|---|---|
| **Trigger condition** | User is authenticated but does not have any active role granting access to the requested project or organization. |
| **User-facing heading** | You don't have access to this project. |
| **User-facing body** | Your account isn't linked to this project. If you believe this is a mistake, contact your contractor or project manager. |
| **Primary CTA** | Contact Contractor |
| **Secondary CTA** | Return to Dashboard |
| **Telemetry event** | `portal.error.unauthorized` |
| **Severity** | Critical |
| **Recoverability** | Recoverable — a new invitation from the organization resolves the state. |
| **Accessibility notes** | Error heading uses `role="alert"` and `aria-live="assertive"`. Focus is moved to the error heading on render. Sufficient color contrast required (WCAG AA). Do not rely on color alone to communicate error state. |
| **Mobile behavior** | Full-screen error state. No navigation chrome visible except the top bar. CTAs stack vertically. |

---

### ES-02 — Expired Invite

| Field | Value |
|---|---|
| **Trigger condition** | User follows an invitation link where the invite token has passed its expiry TTL. |
| **User-facing heading** | Your invitation has expired. |
| **User-facing body** | This invitation link is no longer valid. Ask your contractor to send a new invitation. |
| **Primary CTA** | Request New Invite |
| **Secondary CTA** | Contact Contractor |
| **Telemetry event** | `portal.error.invite_expired` |
| **Severity** | Critical |
| **Recoverability** | Recoverable — organization admin re-issues invitation. |
| **Accessibility notes** | Error state announced via `aria-live="assertive"`. "Request New Invite" button must have a descriptive `aria-label`. |
| **Mobile behavior** | Full-screen state with expired-invite illustration. CTAs displayed as full-width buttons. |

---

### ES-03 — Revoked Access

| Field | Value |
|---|---|
| **Trigger condition** | User's organization membership or project access has been explicitly revoked by an organization admin or LOOP staff. |
| **User-facing heading** | Your access has been removed. |
| **User-facing body** | Your contractor has removed your access to this project. If you have questions, contact them directly. |
| **Primary CTA** | Contact Contractor |
| **Secondary CTA** | None |
| **Telemetry event** | `portal.error.access_revoked` |
| **Severity** | Critical |
| **Recoverability** | Recoverable only if the organization re-issues an invitation. The portal does not allow self-service re-activation. |
| **Accessibility notes** | `role="alert"`, `aria-live="assertive"`. No misleading affordances — do not show project content behind a modal. |
| **Mobile behavior** | Full-screen state. Single centered CTA. No back navigation to project content. |

---

### ES-04 — Missing Project

| Field | Value |
|---|---|
| **Trigger condition** | The project ID in the URL does not exist in the portal's projection, has been archived, or has been permanently removed. |
| **User-facing heading** | This project isn't available. |
| **User-facing body** | This project no longer exists or has been archived. Contact your contractor if you think this is a mistake. |
| **Primary CTA** | Return to Dashboard |
| **Secondary CTA** | Contact Contractor |
| **Telemetry event** | `portal.error.project_not_found` |
| **Severity** | Critical |
| **Recoverability** | Not self-recoverable. Requires contractor intervention if accidental. |
| **Accessibility notes** | Heading uses `role="alert"`. "Return to Dashboard" is the default focus target. |
| **Mobile behavior** | Full-screen state. "Return to Dashboard" is a full-width primary button. |

---

### ES-05 — Stale Feed

| Field | Value |
|---|---|
| **Trigger condition** | The portal's last received event for this project exceeds the freshness SLA threshold (>5 minutes behind). The portal has data but it may not reflect the latest state. |
| **User-facing heading** | Information may be outdated. |
| **User-facing body** | Last synchronized [X minutes ago]. We're working to refresh this. You can continue browsing. |
| **Primary CTA** | Refresh |
| **Secondary CTA** | Dismiss |
| **Telemetry event** | `portal.feed.stale` |
| **Severity** | Warning |
| **Recoverability** | Self-recovering — resolves automatically when the event stream catches up. |
| **Accessibility notes** | Banner uses `role="status"` and `aria-live="polite"` (non-interruptive). Dismiss button must be keyboard accessible. Banner must not obscure primary content. |
| **Mobile behavior** | Sticky top banner beneath the navigation bar. Does not occupy full screen. Scrollable content beneath the banner. Dismissible by tap. |

---

### ES-06 — Service Unavailable

| Field | Value |
|---|---|
| **Trigger condition** | The portal cannot reach its backend (API timeout, 5xx response, or network failure). No cached data is available to serve. |
| **User-facing heading** | LOOP is temporarily unavailable. |
| **User-facing body** | We're working on it. Please try again in a few minutes. If this continues, contact support. |
| **Primary CTA** | Try Again |
| **Secondary CTA** | Contact Support |
| **Telemetry event** | `portal.error.service_unavailable` |
| **Severity** | Critical |
| **Recoverability** | Self-recovering when the backend recovers. "Try Again" triggers a page reload. |
| **Accessibility notes** | Full-screen error must use `role="alert"`. "Try Again" must be the first interactive element in focus order. |
| **Mobile behavior** | Full-screen state. Animated spinner removed after 3 seconds if no recovery. "Try Again" is full-width. |

---

### ES-07 — Empty Timeline

| Field | Value |
|---|---|
| **Trigger condition** | The project exists and the user has access, but no milestone events have been emitted yet (project is newly created or hasn't started). |
| **User-facing heading** | No timeline activity yet. |
| **User-facing body** | Your project timeline will appear here as work progresses. Check back soon. |
| **Primary CTA** | Contact Team |
| **Secondary CTA** | None |
| **Telemetry event** | `portal.empty.timeline` |
| **Severity** | Informational |
| **Recoverability** | Self-resolving — events populate the timeline as project progresses. |
| **Accessibility notes** | Empty state should use a decorative illustration that is `aria-hidden="true"`. Text is sufficient to convey state. |
| **Mobile behavior** | Centered empty state within the timeline tab. No full-screen takeover. Navigation remains accessible. |

---

### ES-08 — Empty Documents

| Field | Value |
|---|---|
| **Trigger condition** | The project exists and the user has access, but no customer-facing documents have been published yet. |
| **User-facing heading** | No documents available yet. |
| **User-facing body** | Documents shared by your contractor will appear here. |
| **Primary CTA** | Contact Team |
| **Secondary CTA** | None |
| **Telemetry event** | `portal.empty.documents` |
| **Severity** | Informational |
| **Recoverability** | Self-resolving — documents appear when published by contractor. |
| **Accessibility notes** | Decorative illustration marked `aria-hidden="true"`. Sufficient text describes the state without relying on imagery. |
| **Mobile behavior** | Centered empty state within the documents tab. Navigation remains visible. |

---

## Error State Decision Tree

```
User accesses portal URL
        │
        ▼
Is user authenticated?
  No  → Redirect to login
  Yes ▼
        │
Does the user have org membership?
  No  → ES-01 Unauthorized
  Yes ▼
        │
Is the invitation still valid?
  No  → ES-02 Expired Invite
  Yes ▼
        │
Is org membership active (not revoked)?
  No  → ES-03 Revoked Access
  Yes ▼
        │
Does the project exist in the projection?
  No  → ES-04 Missing Project
  Yes ▼
        │
Is the backend reachable?
  No  → ES-06 Service Unavailable
  Yes ▼
        │
Is the feed within freshness SLA?
  No  → ES-05 Stale Feed (banner, continue)
  Yes ▼
        │
Render project content
        │
        ├── Timeline empty? → ES-07 Empty Timeline
        └── Documents empty? → ES-08 Empty Documents
```

---

## Telemetry Summary

| Event Name | Trigger |
|---|---|
| `portal.error.unauthorized` | ES-01 |
| `portal.error.invite_expired` | ES-02 |
| `portal.error.access_revoked` | ES-03 |
| `portal.error.project_not_found` | ES-04 |
| `portal.feed.stale` | ES-05 |
| `portal.error.service_unavailable` | ES-06 |
| `portal.empty.timeline` | ES-07 |
| `portal.empty.documents` | ES-08 |

All telemetry events must include: `user_id` (hashed), `organization_id`, `project_id` (if available), `timestamp`, `session_id`, and `error_code`.

---

## Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| OQ-1 | Should ES-05 (Stale Feed) escalate to a different visual treatment after 30 minutes? | Design | Open |
| OQ-2 | Is "Contact Support" in ES-06 a link to an email, a help page, or an in-app chat? | Product | Open |
| OQ-3 | Does ES-03 (Revoked Access) clear the user's session cookie, or keep them authenticated in other orgs? | Engineering | Open |
| OQ-4 | Should "Request New Invite" in ES-02 open an email compose window or an in-portal form? | Design | Open |
| OQ-5 | Are ES-07 and ES-08 displayed as tabs with an empty state, or does the tab disappear when empty? | Design | Open |
