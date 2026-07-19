import type {
  PortalFreshnessStatus,
  PortalProjectionCheckpoint,
  PortalProjectionState,
} from "../types/integration";

export interface PortalCheckpointStore {
  get(projectId: string): Promise<PortalProjectionCheckpoint | null>;
  save(
    checkpoint: Omit<PortalProjectionCheckpoint, "version"> & { version?: number }
  ): Promise<PortalProjectionCheckpoint>;
  restoreLastKnownGoodState(projectId: string): Promise<PortalProjectionCheckpoint | null>;
}

export class InMemoryPortalCheckpointStore implements PortalCheckpointStore {
  private readonly current = new Map<string, PortalProjectionCheckpoint>();
  private readonly history = new Map<string, PortalProjectionCheckpoint[]>();

  async get(projectId: string): Promise<PortalProjectionCheckpoint | null> {
    return this.current.get(projectId) ?? null;
  }

  async save(
    checkpoint: Omit<PortalProjectionCheckpoint, "version"> & { version?: number }
  ): Promise<PortalProjectionCheckpoint> {
    const previous = this.current.get(checkpoint.projectId);
    const next: PortalProjectionCheckpoint = {
      ...checkpoint,
      version: checkpoint.version ?? (previous?.version ?? 0) + 1,
    };

    const existingHistory = this.history.get(checkpoint.projectId) ?? [];
    if (previous) {
      existingHistory.push(previous);
    }

    this.history.set(checkpoint.projectId, existingHistory);
    this.current.set(checkpoint.projectId, next);
    return next;
  }

  async restoreLastKnownGoodState(
    projectId: string
  ): Promise<PortalProjectionCheckpoint | null> {
    const history = this.history.get(projectId) ?? [];
    const restored = history.pop() ?? null;

    if (restored) {
      this.current.set(projectId, restored);
      this.history.set(projectId, history);
    }

    return restored;
  }
}

export interface PortalFreshnessPolicy {
  staleAfterMinutes?: number;
  criticalAfterMinutes?: number;
  feedAvailable?: boolean;
}

export function buildPortalFreshnessStatus(
  lastSynchronizedAt: string | undefined,
  now = new Date(),
  policy: PortalFreshnessPolicy = {}
): PortalFreshnessStatus {
  const staleAfterMinutes = policy.staleAfterMinutes ?? 5;
  const criticalAfterMinutes = policy.criticalAfterMinutes ?? 15;
  const feedAvailable = policy.feedAvailable ?? true;

  if (!feedAvailable) {
    return {
      state: "disrupted",
      ageMinutes: lastSynchronizedAt
        ? Math.max(0, Math.floor((now.getTime() - Date.parse(lastSynchronizedAt)) / 60000))
        : criticalAfterMinutes,
      message:
        "Information may be outdated. The portal is serving the last known good state while the event feed recovers.",
      lastSynchronizedAt,
    };
  }

  if (!lastSynchronizedAt) {
    return {
      state: "critical",
      ageMinutes: criticalAfterMinutes,
      message:
        "Information may be outdated. The portal does not yet have a successful synchronization checkpoint.",
      lastSynchronizedAt,
    };
  }

  const ageMinutes = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(lastSynchronizedAt)) / 60000)
  );

  if (ageMinutes > criticalAfterMinutes) {
    return {
      state: "critical",
      ageMinutes,
      message: `Information may be outdated. Last synchronized ${ageMinutes} minutes ago.`,
      lastSynchronizedAt,
    };
  }

  if (ageMinutes >= staleAfterMinutes) {
    return {
      state: "stale",
      ageMinutes,
      message: `Information may be outdated. Last synchronized ${ageMinutes} minutes ago.`,
      lastSynchronizedAt,
    };
  }

  return {
    state: "fresh",
    ageMinutes,
    message: `Last synchronized ${ageMinutes} minute${ageMinutes === 1 ? "" : "s"} ago.`,
    lastSynchronizedAt,
  };
}

export function capturePortalCheckpoint(
  state: PortalProjectionState,
  lastProcessedEventId?: string,
  lastProcessedIdempotencyKey?: string,
  capturedAt = new Date().toISOString()
): Omit<PortalProjectionCheckpoint, "version"> {
  return {
    projectId: state.projectId,
    capturedAt,
    state,
    lastProcessedEventId,
    lastProcessedIdempotencyKey,
  };
}
