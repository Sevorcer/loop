"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { mockInventoryAllocations } from "../data/mockInventoryAllocations";
import { mockInventoryItems } from "../data/mockInventoryItems";
import { mockJobMaterialPlans } from "../data/mockJobMaterialPlans";
import type {
  InventoryAllocation,
  InventoryItem,
  InventorySnapshot,
  JobMaterialPlan,
} from "../types/inventory";
import { assembleInventorySnapshot } from "../utils/inventoryUtils";

interface InventoryContextValue {
  snapshot: InventorySnapshot;
  getMaterialPlanForJob: (jobId: string) => JobMaterialPlan | undefined;
  getInventoryItemById: (id: string) => InventoryItem | undefined;
  getAllocationsForJob: (jobId: string) => InventoryAllocation[];
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const snapshot = useMemo(
    () =>
      assembleInventorySnapshot(
        mockInventoryItems,
        mockInventoryAllocations,
        mockJobMaterialPlans
      ),
    []
  );

  const value = useMemo<InventoryContextValue>(() => {
    function getMaterialPlanForJob(jobId: string) {
      return snapshot.materialPlans.find((plan) => plan.jobId === jobId);
    }

    function getInventoryItemById(id: string) {
      return snapshot.inventoryItems.find((item) => item.id === id);
    }

    function getAllocationsForJob(jobId: string) {
      return snapshot.allocations.filter((alloc) => alloc.jobId === jobId);
    }

    return {
      snapshot,
      getMaterialPlanForJob,
      getInventoryItemById,
      getAllocationsForJob,
    };
  }, [snapshot]);

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);

  if (!context) {
    throw new Error("useInventory must be used within an InventoryProvider");
  }

  return context;
}
