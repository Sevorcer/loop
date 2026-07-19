// ============================================================
// Live Operations — Derivation Utils
// Sprint 16
//
// All views are derived from the shared OperationalEvent[].
// No component computes its own data independently.
// ============================================================

import type {
  InitialCrewSeed,
  InitialWorkOrderSeed,
  LiveCrewCard,
  LiveOpsHeroMetrics,
  LiveOpsSnapshot,
  LiveWorkOrder,
  OperationalEvent,
  OperationalHealthSummary,
  WorkOrderMilestone,
} from "../types/liveOps";

// ------------------------------------------------------------------
// Decision Feed
// Events where requiresDecision === true and not yet resolved.
// ------------------------------------------------------------------

export function deriveDecisions(events: OperationalEvent[]): OperationalEvent[] {
  return events.filter((e) => e.requiresDecision === true && !e.resolved);
}

// ------------------------------------------------------------------
// Needs Attention
// Unresolved events with severity warning or critical.
// ------------------------------------------------------------------

export function deriveAttention(events: OperationalEvent[]): OperationalEvent[] {
  return events.filter(
    (e) => (e.severity === "warning" || e.severity === "critical") && !e.resolved
  );
}

// ------------------------------------------------------------------
// Operational Health
// Derived from obvious facts: count unresolved critical and warning events.
// ------------------------------------------------------------------

export function deriveHealth(events: OperationalEvent[]): OperationalHealthSummary {
  const critical = events.filter((e) => e.severity === "critical" && !e.resolved);
  const warnings = events.filter((e) => e.severity === "warning" && !e.resolved);

  const reasons: string[] = [];

  if (critical.length > 0) {
    reasons.push(
      `${critical.length} critical issue${critical.length > 1 ? "s" : ""}`
    );
  }
  if (warnings.length > 0) {
    reasons.push(
      `${warnings.length} active warning${warnings.length > 1 ? "s" : ""}`
    );
  }

  if (critical.length >= 2) {
    return { state: "critical", label: "Critical", reasons };
  }
  if (critical.length === 1) {
    return { state: "needs_attention", label: "Needs Attention", reasons };
  }
  if (warnings.length >= 2) {
    return { state: "minor_issues", label: "Minor Issues", reasons };
  }
  if (warnings.length === 1) {
    return { state: "minor_issues", label: "Minor Issues", reasons };
  }
  return { state: "healthy", label: "Healthy", reasons: ["No open issues"] };
}

// ------------------------------------------------------------------
// Hero Metrics
// ------------------------------------------------------------------

export function deriveHeroMetrics(
  events: OperationalEvent[],
  crews: LiveCrewCard[]
): LiveOpsHeroMetrics {
  const activeCrews = crews.filter(
    (c) => c.operationalState !== "available" && c.operationalState !== "standby"
  ).length;

  const jobsRunning = crews.filter(
    (c) => c.workOrderId !== null && c.operationalState !== "available" && c.operationalState !== "standby"
  ).length;

  // Delays = unresolved events that represent schedule disruptions
  const delayTypes = new Set(["crew_delayed", "eta_slip", "customer_delay"]);
  const delays = events.filter((e) => delayTypes.has(e.type) && !e.resolved).length;

  const criticalIssues = events.filter(
    (e) => e.severity === "critical" && !e.resolved
  ).length;

  const lastEvent = events.length > 0 ? events[events.length - 1] : null;

  return {
    activeCrews,
    jobsRunning,
    delays,
    criticalIssues,
    lastEventTimeLabel: lastEvent?.timeLabel ?? null,
  };
}

// ------------------------------------------------------------------
// Crew Cards
// Last known operational state per crew, derived from events.
// ------------------------------------------------------------------

export function deriveCrewCards(
  events: OperationalEvent[],
  seeds: InitialCrewSeed[],
  workOrders: LiveWorkOrder[]
): LiveCrewCard[] {
  return seeds.map((seed): LiveCrewCard => {
    // Collect events relevant to this crew, in order
    const crewEvents = events.filter((e) => e.relatedCrewId === seed.crewId);

    // Find the last known state event
    const lastStateEvent = [...crewEvents]
      .reverse()
      .find((e) =>
        [
          "crew_dispatched",
          "crew_en_route",
          "crew_arrived",
          "milestone_advanced",
          "crew_delayed",
          "blocker_resolved",
          "job_completed",
        ].includes(e.type)
      );

    // Determine operational state
    let operationalState: LiveCrewCard["operationalState"] = "available";
    if (lastStateEvent) {
      switch (lastStateEvent.type) {
        case "crew_dispatched":
        case "crew_en_route":
          operationalState = "traveling";
          break;
        case "crew_arrived":
          operationalState = "on_site";
          break;
        case "milestone_advanced": {
          const wo = lastStateEvent.relatedWorkOrderId
            ? workOrders.find((w) => w.id === lastStateEvent.relatedWorkOrderId)
            : null;
          if (wo?.milestone === "working" || wo?.milestone === "quality_check") {
            operationalState = "working";
          } else if (wo?.milestone === "arrived") {
            operationalState = "on_site";
          } else if (wo?.milestone === "en_route") {
            operationalState = "traveling";
          } else if (wo?.milestone === "complete") {
            operationalState = "available";
          } else {
            operationalState = "dispatched";
          }
          break;
        }
        case "crew_delayed":
          operationalState = "delayed";
          break;
        case "blocker_resolved":
          operationalState = "traveling";
          break;
        case "job_completed":
          operationalState = "available";
          break;
      }
    }

    // Check for unresolved blocker against this crew
    const unresolvedBlocker = crewEvents.find(
      (e) =>
        (e.type === "crew_delayed" || e.type === "permit_issue" || e.type === "customer_delay") &&
        !e.resolved
    );

    if (unresolvedBlocker) {
      operationalState = "delayed";
    }

    // Find the active work order
    const activeWo = workOrders.find(
      (w) => w.assignedCrewId === seed.crewId && w.milestone !== "complete"
    ) ?? null;

    // Determine ETA from the last crew_en_route or crew_dispatched event
    const etaEvent = [...crewEvents]
      .reverse()
      .find((e) => e.type === "crew_dispatched" || e.type === "crew_en_route");
    const eta = etaEvent?.actionRecommendation ?? null;

    return {
      crewId: seed.crewId,
      crewName: seed.crewName,
      technician: seed.technician,
      workOrderId: activeWo?.id ?? null,
      customer: activeWo?.customer ?? null,
      currentMilestone: activeWo?.milestone ?? null,
      minutesInMilestone: activeWo?.minutesInMilestone ?? 0,
      eta: operationalState === "traveling" ? eta : null,
      operationalState,
      hasBlocker: !!unresolvedBlocker,
      blockerLabel: unresolvedBlocker?.title ?? null,
    };
  });
}

// ------------------------------------------------------------------
// Work Orders
// Last known milestone per work order, derived from events.
// ------------------------------------------------------------------

export function deriveWorkOrders(
  events: OperationalEvent[],
  seeds: InitialWorkOrderSeed[]
): LiveWorkOrder[] {
  return seeds.map((seed): LiveWorkOrder => {
    const woEvents = events.filter((e) => e.relatedWorkOrderId === seed.id);

    // Find the latest milestone event
    const milestoneEvents = woEvents.filter(
      (e) =>
        e.type === "milestone_advanced" ||
        e.type === "crew_arrived" ||
        e.type === "crew_dispatched" ||
        e.type === "crew_en_route" ||
        e.type === "job_completed"
    );

    let milestone: WorkOrderMilestone = "assigned";
    if (milestoneEvents.length > 0) {
      const last = milestoneEvents[milestoneEvents.length - 1];
      if (last.type === "job_completed") {
        milestone = "complete";
      } else if (last.type === "crew_arrived") {
        milestone = "arrived";
      } else if (last.type === "crew_dispatched" || last.type === "crew_en_route") {
        milestone = "en_route";
      } else if (last.type === "milestone_advanced") {
        // The title of milestone_advanced encodes the new milestone
        const titleLower = last.title.toLowerCase();
        if (titleLower.includes("working") || titleLower.includes("installation") || titleLower.includes("diagnostic")) {
          milestone = "working";
        } else if (titleLower.includes("quality")) {
          milestone = "quality_check";
        } else if (titleLower.includes("complete")) {
          milestone = "complete";
        } else if (titleLower.includes("arrived") || titleLower.includes("on site")) {
          milestone = "arrived";
        } else if (titleLower.includes("en route") || titleLower.includes("traveling")) {
          milestone = "en_route";
        } else {
          milestone = "working";
        }
      }
    }

    const unresolvedBlocker = woEvents.find(
      (e) =>
        (e.type === "permit_issue" || e.type === "customer_delay" || e.type === "crew_delayed") &&
        !e.resolved
    );

    return {
      ...seed,
      milestone,
      minutesInMilestone: 0,
      isBlocked: !!unresolvedBlocker,
      blockerLabel: unresolvedBlocker?.title ?? null,
    };
  });
}

// ------------------------------------------------------------------
// Snapshot assembly
// ------------------------------------------------------------------

export function assembleLiveOpsSnapshot(
  date: string,
  startedAt: string,
  events: OperationalEvent[],
  crewSeeds: InitialCrewSeed[],
  workOrderSeeds: InitialWorkOrderSeed[]
): LiveOpsSnapshot {
  const workOrders = deriveWorkOrders(events, workOrderSeeds);
  const crews = deriveCrewCards(events, crewSeeds, workOrders);

  return {
    date,
    startedAt,
    heroMetrics: deriveHeroMetrics(events, crews),
    health: deriveHealth(events),
    crews,
    workOrders,
    events,
    decisions: deriveDecisions(events),
    attention: deriveAttention(events),
  };
}
