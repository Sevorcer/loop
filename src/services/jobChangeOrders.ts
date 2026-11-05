import {
  create as createRecord,
  deleteChangeOrder as deleteRecord,
  getById as getByIdRecord,
  listByJobId as listByJobIdRecord,
  update as updateRecord,
  isChangeOrderStatus,
  type CreateChangeOrderInput,
  type JobChangeOrder,
  type ChangeOrderStatus,
  type UpdateChangeOrderInput,
} from "@/repositories/jobChangeOrders";

export type { JobChangeOrder, ChangeOrderStatus, CreateChangeOrderInput, UpdateChangeOrderInput };
export { isChangeOrderStatus };

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listByJobId(jobId: string): Promise<JobChangeOrder[]> {
  return listByJobIdRecord(jobId);
}

export async function getById(id: string): Promise<JobChangeOrder> {
  return getByIdRecord(id);
}

export async function createChangeOrder(input: CreateChangeOrderInput): Promise<JobChangeOrder> {
  const title = (input.title ?? "").trim();
  if (!title) {
    throw new Error("Title is required.");
  }
  if (typeof input.amountCents !== "number" || input.amountCents < 0) {
    throw new Error("Amount must be a non-negative number.");
  }
  return createRecord({ ...input, title });
}

export async function updateChangeOrder(
  id: string,
  input: UpdateChangeOrderInput,
): Promise<JobChangeOrder> {
  if (input.status !== undefined && !isChangeOrderStatus(input.status)) {
    throw new Error(`Invalid change order status: ${input.status}`);
  }
  if (input.amountCents !== undefined && input.amountCents < 0) {
    throw new Error("Amount must be a non-negative number.");
  }
  return updateRecord(id, input);
}

export async function deleteChangeOrder(id: string): Promise<void> {
  return deleteRecord(id);
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

export async function approveChangeOrder(id: string): Promise<JobChangeOrder> {
  return updateRecord(id, {
    status: "approved",
    approvedAt: new Date().toISOString(),
  });
}

export async function declineChangeOrder(id: string): Promise<JobChangeOrder> {
  return updateRecord(id, {
    status: "declined",
    approvedAt: null,
  });
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export async function getApprovedTotal(jobId: string): Promise<number> {
  const orders = await listByJobIdRecord(jobId);
  return orders
    .filter((co) => co.status === "approved")
    .reduce((sum, co) => sum + co.amountCents, 0);
}

/** Office+ roles that can manage change orders. */
export function canEditChangeOrders(role: string): boolean {
  return role === "owner" || role === "manager" || role === "office";
}

/** Only owner/manager can delete change orders. */
export function canDeleteChangeOrders(role: string): boolean {
  return role === "owner" || role === "manager";
}
