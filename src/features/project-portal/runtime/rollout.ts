export type PortalLaunchGateKey =
  | "LG-01"
  | "LG-02"
  | "LG-03"
  | "LG-04"
  | "LG-05"
  | "LG-06"
  | "LG-07"
  | "LG-08"
  | "LG-09"
  | "LG-10"
  | "LG-11"
  | "LG-12";

export type PortalCapabilityFlag =
  | "ingestion"
  | "projectionRebuild"
  | "staleDataBanner"
  | "documentPublishing"
  | "photoPublishing"
  | "reportingMetrics";

export interface PortalRolloutControl {
  isEnabled(flag: PortalCapabilityFlag): boolean;
  gateStatus(gate: PortalLaunchGateKey): "pass" | "pending" | "blocked";
}

export interface PortalTelemetryEvent {
  name: string;
  timestamp: string;
  projectId?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

export interface PortalTelemetrySink {
  emit(event: PortalTelemetryEvent): Promise<void>;
  flush(): Promise<readonly PortalTelemetryEvent[]>;
}

export class StaticPortalRolloutControl implements PortalRolloutControl {
  constructor(
    private readonly flags: Record<PortalCapabilityFlag, boolean>,
    private readonly gates: Partial<Record<PortalLaunchGateKey, "pass" | "pending" | "blocked">> = {}
  ) {}

  isEnabled(flag: PortalCapabilityFlag): boolean {
    return this.flags[flag];
  }

  gateStatus(gate: PortalLaunchGateKey): "pass" | "pending" | "blocked" {
    return this.gates[gate] ?? "pending";
  }
}

export class InMemoryPortalTelemetrySink implements PortalTelemetrySink {
  private readonly events: PortalTelemetryEvent[] = [];

  async emit(event: PortalTelemetryEvent): Promise<void> {
    this.events.push(event);
  }

  async flush(): Promise<readonly PortalTelemetryEvent[]> {
    return [...this.events];
  }
}

export const defaultPortalRolloutControl = new StaticPortalRolloutControl({
  ingestion: true,
  projectionRebuild: true,
  staleDataBanner: true,
  documentPublishing: true,
  photoPublishing: true,
  reportingMetrics: true,
});
