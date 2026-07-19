# UI/UX Improvement Log

## Hierarchy problems

| Severity | Area | Current reality | Recommended improvement |
| --- | --- | --- | --- |
| P1 | Dispatch | The page teaches the domain model before giving the dispatcher an obvious action surface. | Move the live board higher and compress explanatory content into secondary panels or expandable help. |
| P1 | Inventory | The strongest actionable content starts below the hero and architecture note. | Promote the warehouse list or attention-needed jobs higher in the first viewport. |
| P2 | Installed Systems | The route explains technical identity well, but the list itself lands lower than expected. | Make unresolved system matches visible immediately and give them a stronger action lane. |
| P2 | Company Brain | Search is the core action, but the route spends a lot of space on framing before the answer loop settles. | Tighten top-of-page framing so the search/result loop dominates sooner. |
| P2 | Jobs | Hero treatment competes with the job board on smaller screens. | Reduce hero height and bias the first viewport toward active work and filters. |

## Spacing and density issues

| Severity | Area | Current reality | Recommended improvement |
| --- | --- | --- | --- |
| P1 | Daily Plans | Crew-heavy layouts become tall quickly, especially once notes and readiness panels stack beside them. | Compress secondary copy, trim padding in stacked cards, and make exception states more visually compact on mobile. |
| P2 | Shared shell + page heroes | Many routes combine sticky header, hero card, metric tiles, and a second explanatory card before core content. | Establish a lighter hero variant for mature workspaces where data tables or boards are the primary task surface. |
| P2 | Company Brain | Filter chips, search framing, metrics, and lifecycle content create a long page before the user fully resolves one task. | Break the screen into a tighter search workspace and a more secondary “knowledge health” section. |
| P3 | Dashboard | Card spacing is calm, but quick-action tiles look visually equal to more meaningful operational modules. | Reduce decorative weight on quick-action tiles or turn them into real launch surfaces. |

## Navigation confusion

| Severity | Area | Current reality | Recommended improvement |
| --- | --- | --- | --- |
| P1 | Daily Plans / Live Operations / Dispatch | Three adjacent operations routes cover planning, scheduling, and active execution, but the shell does little to explain the handoff. | Add clearer route descriptions, progression cues, or inline “next workspace” links between the domains. |
| P1 | Live Operations | The route is always available in the sidebar even when the day is inactive. | Signal inactive state before navigation, or route users through Daily Plans when activation has not happened yet. |
| P2 | Nested detail pages | Breadcrumbs usually resolve to Dashboard plus the current page label. | Show full domain hierarchy for job, property, customer, and installed-system detail routes. |
| P2 | Reporting | The page shows interpretation but not a clear path back to source domains. | Add drilldowns from indicators and scorecards into the owning operational workspace. |
| P3 | Customers + Vehicle Alerts | These routes are visible peers in the shell but feel slightly outside the same route-definition pattern as the main domains. | Bring them into the same navigation source-of-truth and apply the same cross-link standards. |

## Mobile friction

| Severity | Area | Current reality | Recommended improvement |
| --- | --- | --- | --- |
| P1 | Dispatch | Metric tiles plus explanatory cards can push the actual board too far below the fold. | Collapse explanatory content and prioritize board visibility in the first viewport. |
| P1 | Inventory | Users may scroll past framing before they reach warehouse or material-plan content. | Lead with the most operationally urgent list on mobile. |
| P2 | Daily Plans | Multi-column desktop logic compresses into long vertical sections. | Introduce stronger section collapsing, tighter crew cards, or pinned “attention first” blocks on mobile. |
| P2 | Company Brain | The route becomes a long reading surface before it becomes a quick answer surface. | Keep search fixed higher and shorten pre-result framing on small screens. |
| P2 | Shared shell | Sticky header plus repeated page heroes consumes valuable vertical space on phones. | Define a more compact mobile-first hero pattern for dense operational pages. |

## Consistency issues

| Severity | Area | Current reality | Recommended improvement |
| --- | --- | --- | --- |
| P1 | Top-level CTAs | `New Property`, `New Customer`, and `Report Alert` read like real entry points but do not complete a flow. | Either wire them fully or restyle them as secondary/not-yet-available actions until the workflows exist. |
| P2 | Dashboard quick actions | Tiles resemble launch controls but currently behave more like static placeholders. | Turn each tile into a real route or reduce the implied clickability. |
| P2 | Domain maturity signaling | The shell presents mature and immature routes with the same confidence. | Introduce subtle maturity cues for placeholder or limited workspaces. |
| P3 | Page framing style | Many domains reuse the same “badge + headline + metrics + architecture note” rhythm regardless of task type. | Create a few approved page patterns: summary, board, directory, detail, and intelligence. |
