import type { UserAccountStatus } from "../types";

interface UserStatusBadgeProps {
  status: UserAccountStatus;
}

export function UserStatusBadge({ status }: UserStatusBadgeProps) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold status-success">
        Active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold status-neutral">
      Inactive
    </span>
  );
}
