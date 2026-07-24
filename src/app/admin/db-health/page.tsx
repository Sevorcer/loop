import { DbHealthScreen } from "@/features/admin/db-health/screens/DbHealthScreen";

/**
 * /admin/db-health — DB health dashboard.
 * Accessible to owner and manager roles.
 */
export default function DbHealthPage() {
  return <DbHealthScreen />;
}
