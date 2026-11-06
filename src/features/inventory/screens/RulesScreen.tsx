import { AccessDenied } from "@/components/atlas/AccessDenied";
import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { getSettings } from "@/services/inventorySettings";

import { InventoryFrame } from "../components/InventoryFrame";
import { RulesForm } from "../components/RulesForm";
import { getInventoryAccess } from "../server/inventoryAccess";
import type { CloseoutEnforcement } from "../types/kits";

const ENFORCEMENT_COPY: Record<CloseoutEnforcement, { label: string; variant: "success" | "warning" | "danger"; text: string }> = {
  warn: {
    label: "Warn only",
    variant: "success",
    text: "Leftover or missing materials show a warning at closeout. Nothing blocks a job from being completed.",
  },
  soft: {
    label: "Office override",
    variant: "warning",
    text: "A job cannot be completed until materials are reconciled, unless an office role records an override reason.",
  },
  hard: {
    label: "Required",
    variant: "danger",
    text: "A job cannot be completed until materials are reconciled.",
  },
};

/** Inventory rules: readiness timing and the closeout enforcement stage. */
export async function RulesScreen() {
  const access = await getInventoryAccess();
  if (!access.canViewSettings) {
    return (
      <InventoryFrame title="Inventory">
        <AccessDenied title="Inventory rules are not available for your role" />
      </InventoryFrame>
    );
  }

  const settings = await getSettings();
  const enforcement = ENFORCEMENT_COPY[settings.closeoutEnforcement];

  return (
    <InventoryFrame title="Inventory" description="How early LOOP flags a job whose materials are not ready, and how strict closeout is.">
      <SectionCard
        title="Material readiness"
        description="Used when a job’s material plan is checked against stock and incoming orders."
      >
        <RulesForm settings={settings} canEdit={access.canEditSettings} />
      </SectionCard>

      <SectionCard title="Closeout reconciliation" description="Starts as a warning only, and stays that way until you decide otherwise.">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <StatusBadge variant={enforcement.variant}>{enforcement.label}</StatusBadge>
          <p className="text-sm text-muted">{enforcement.text}</p>
        </div>
        <p className="mt-3 text-xs text-muted">
          This stage can be changed once closeout reconciliation is available. Until then, nothing blocks job completion.
        </p>
      </SectionCard>
    </InventoryFrame>
  );
}
