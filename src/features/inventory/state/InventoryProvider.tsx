"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type {
  InventoryAllocation,
  InventoryItem,
  InventorySnapshot,
  JobMaterialPlan,
} from "../types/inventory";
import { assembleInventorySnapshot } from "../utils/inventoryUtils";

const EMPTY_MESSAGE =
  "No inventory is stored yet. Sample parts have been removed, so this page stays empty until real stock is added to the database.";

interface InventoryContextValue {
  snapshot: InventorySnapshot;
  emptyMessage: string | null;
  loading: boolean;
  getMaterialPlanForJob: (jobId: string) => JobMaterialPlan | undefined;
  getInventoryItemById: (id: string) => InventoryItem | undefined;
  getAllocationsForJob: (jobId: string) => InventoryAllocation[];
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const { role } = useCurrentRole();
  const [snapshot, setSnapshot] = useState<InventorySnapshot>(() =>
    assembleInventorySnapshot([], [], []),
  );
  const [emptyMessage, setEmptyMessage] = useState<string | null>(EMPTY_MESSAGE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!role) return;
    let cancelled = false;

    async function load() {
      try {
        const result = await requestJson<{ items: InventoryItem[]; missingTable: boolean }>(
          "/api/inventory",
          { role, cache: "no-store" },
        );
        if (cancelled) return;
        const items = Array.isArray(result.items) ? result.items : [];
        setSnapshot(assembleInventorySnapshot(items, [], []));
        setEmptyMessage(
          items.length > 0
            ? null
            : result.missingTable
              ? EMPTY_MESSAGE
              : "No inventory items yet. Add equipment and parts and they will show up here.",
        );
      } catch {
        if (!cancelled) {
          setSnapshot(assembleInventorySnapshot([], [], []));
          setEmptyMessage("Inventory could not be loaded. Nothing on this page is sample data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [role]);

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
      emptyMessage,
      loading,
      getMaterialPlanForJob,
      getInventoryItemById,
      getAllocationsForJob,
    };
  }, [emptyMessage, loading, snapshot]);

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
