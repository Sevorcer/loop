import { AccessDenied } from "@/components/atlas/AccessDenied";
import { SectionCard } from "@/components/atlas/SectionCard";
import { getSettings } from "@/services/inventorySettings";

import { InventoryFrame } from "../components/InventoryFrame";
import { EnforcementForm } from "../components/EnforcementForm";
import { RulesForm } from "../components/RulesForm";
import { getInventoryAccess } from "../server/inventoryAccess";
import type { CloseoutEnforcement } from "../types/kits";

const ENFORCEMENT_OPTIONS: Array<{ value: CloseoutEnforcement; label: string; text: string }> = [
  {
    value: "warn",
    label: "Warn only",
    text: "Leftover or missing materials show a warning at closeout. Nothing blocks a job from being completed.",
  },
  {
    value: "soft",
    label: "Office override",
    text: "A job cannot be completed until materials are reconciled, unless an office role records an override reason. Technicians cannot override.",
  },
  {
    value: "hard",
    label: "Required",
    text: "A job cannot be completed until materials are reconciled. No one can override.",
  },
];

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

  return (
    <InventoryFrame title="Inventory" description="How early LOOP flags a job whose materials are not ready, and how strict closeout is.">
      <SectionCard
        title="Material readiness"
        description="Used when a job’s material plan is checked against stock and incoming orders."
      >
        <RulesForm settings={settings} canEdit={access.canEditSettings} />
      </SectionCard>

      <SectionCard
        title="Closeout reconciliation"
        description="Starts as a warning only. Move it up when you are happy with the numbers coming back."
      >
        <EnforcementForm current={settings.closeoutEnforcement} options={ENFORCEMENT_OPTIONS} canEdit={access.canEditSettings} />
      </SectionCard>
    </InventoryFrame>
  );
}
