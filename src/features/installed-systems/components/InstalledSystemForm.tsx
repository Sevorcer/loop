"use client";

import { useEffect, useState } from "react";
import { Cpu, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { pushToast } from "@/components/ui/toast";
import { requestJson } from "@/lib/api/client";
import { useCurrentRole } from "@/features/auth";
import type { Customer } from "@/features/customers/types/customer";
import type { Property } from "@/features/properties/types/property";
import { ROUTES, ROUTE_BUILDERS } from "@/lib/routes";

import type { InstalledSystem, InstalledSystemLifecycle } from "../types/installedSystem";
import { useInstalledSystems } from "../state/InstalledSystemsProvider";
import { canEditWarrantyExpiry } from "../utils/installedSystemFormAccess";

const LIFECYCLE_OPTIONS: InstalledSystemLifecycle[] = ["Planned", "Active", "Needs Review"];

interface FormValues {
  systemName: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  warrantyExpiry: string;
  customerName: string;
  propertyName: string;
  location: string;
  installDate: string;
  lifecycleStatus: InstalledSystemLifecycle;
}

function toFormValues(system?: InstalledSystem): FormValues {
  return {
    systemName: system?.systemName ?? "",
    manufacturer: system?.manufacturer ?? "",
    modelNumber: system?.modelNumber ?? "",
    serialNumber: system?.serialNumbers?.[0] ?? "",
    warrantyExpiry: system?.warrantyExpiry ?? "",
    customerName: system?.customerName ?? "",
    propertyName: system?.propertyName ?? "",
    location: system?.location ?? "",
    installDate: system?.installDate ?? "",
    lifecycleStatus: system?.lifecycleStatus ?? "Planned",
  };
}

/** F9: install date accepts a year ("2024") or a full date ("2024-06-15"). */
export function isInstallDateValueValid(value: string): boolean {
  return /^(\d{4}|\d{4}-\d{2}-\d{2})$/.test(value.trim());
}

export interface InstalledSystemFormContext {
  jobId?: string;
  jobNumber?: string;
  propertyId?: string;
  customerName?: string;
  propertyName?: string;
}

interface InstalledSystemFormProps {
  system?: InstalledSystem;
  context?: InstalledSystemFormContext;
  /**
   * Opt-in dialog mode. When provided, a successful create calls `onCreated`
   * with the new system — after the installed-systems provider has been
   * refreshed — instead of navigating to the system detail page, so the caller
   * (e.g. the job Systems tab) can stay in place and surface the new record
   * itself. The server create path is unchanged: same POST /api/installed-systems.
   */
  onCreated?: (system: InstalledSystem) => void;
  /** When provided, Cancel calls this instead of navigating to `cancelHref`. */
  onCancel?: () => void;
  /** Drops the standalone-page hero so the form sits cleanly inside a dialog. */
  embedded?: boolean;
}

export function InstalledSystemForm({
  system,
  context,
  onCreated,
  onCancel,
  embedded = false,
}: InstalledSystemFormProps) {
  const router = useRouter();
  const { role } = useCurrentRole();
  const { refreshSystems } = useInstalledSystems();
  const [form, setForm] = useState<FormValues>(() => {
    const base = toFormValues(system);
    if (!system && context) {
      return {
        ...base,
        customerName: context.customerName ?? base.customerName,
        propertyName: context.propertyName ?? base.propertyName,
      };
    }
    return base;
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [propertyOptions, setPropertyOptions] = useState<Property[]>([]);
  // Directory loads can fail outright (e.g. roles without customer-directory
  // access get a 403). When one does, the picker would be a dead end — the
  // form falls back to a plain name field instead, since names are what the
  // form actually submits.
  const [customerDirectoryFailed, setCustomerDirectoryFailed] = useState(false);
  const [propertyDirectoryFailed, setPropertyDirectoryFailed] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  // Server-side picker search results, tagged with the query (and customer
  // scope, for properties) they belong to; stale results are ignored.
  const [customerSearchResults, setCustomerSearchResults] = useState<{
    query: string;
    customers: Customer[];
  } | null>(null);
  const [propertySearch, setPropertySearch] = useState("");
  const [propertySearchResults, setPropertySearchResults] = useState<{
    query: string;
    scope: string | null;
    properties: Property[];
  } | null>(null);
  // Properties belonging to the selected customer, tagged with its id.
  const [scopedPropertiesState, setScopedPropertiesState] = useState<{
    customerId: string;
    properties: Property[];
  } | null>(null);
  // Track the chosen property's id so create/save writes property_id, not just the name.
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    context?.propertyId ?? system?.propertyId ?? null,
  );
  const canEditWarranty = canEditWarrantyExpiry(role);

  // F6: pickers instead of free text — typo-proof customer/property linking.
  useEffect(() => {
    if (!role) return;
    requestJson<{ customers: Customer[] }>("/api/customers", { role })
      .then((res) => setCustomerOptions(res.customers ?? []))
      .catch(() => {
        setCustomerOptions([]);
        setCustomerDirectoryFailed(true);
      });
    requestJson<{ properties: Property[] }>("/api/properties", { role })
      .then((res) => setPropertyOptions(res.properties ?? []))
      .catch(() => {
        setPropertyOptions([]);
        setPropertyDirectoryFailed(true);
      });
  }, [role]);

  // When the form is locked to a job property (or editing), that property can
  // sit beyond the first picker page — fetch it by id so the select shows it.
  useEffect(() => {
    if (!role || !context?.propertyId) return;
    if (propertyOptions.some((property) => property.id === context.propertyId)) return;
    let cancelled = false;
    void requestJson<{ property: Property }>(`/api/properties/${context.propertyId}`, { role })
      .then((res) => {
        if (!cancelled && res.property) {
          setPropertyOptions((current) =>
            current.some((property) => property.id === res.property.id)
              ? current
              : [...current, res.property],
          );
        }
      })
      .catch(() => {
        // Best-effort; the fallback option still renders the current value.
      });
    return () => {
      cancelled = true;
    };
  }, [context?.propertyId, propertyOptions, role]);

  // The directories are far larger than one picker page, so typing in a
  // search box queries the server-side search and the select shows the
  // actual matches instead of the first loaded page. Results are tagged
  // with the query/scope they belong to; stale results are ignored.
  useEffect(() => {
    if (!role) return;
    const query = customerSearch.trim();
    if (!query) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void requestJson<{ customers: Customer[] }>(
        `/api/customers?search=${encodeURIComponent(query)}`,
        { role },
      )
        .then((res) => {
          if (!cancelled) {
            setCustomerSearchResults({ query, customers: res.customers ?? [] });
          }
        })
        .catch(() => {
          if (!cancelled) setCustomerSearchResults({ query, customers: [] });
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [customerSearch, role]);

  const trimmedCustomerSearch = customerSearch.trim();
  const searchedCustomers =
    trimmedCustomerSearch &&
    customerSearchResults &&
    customerSearchResults.query === trimmedCustomerSearch
      ? customerSearchResults.customers
      : null;
  const visibleCustomerOptions = searchedCustomers ?? customerOptions;
  const selectedCustomerId =
    [...customerOptions, ...(searchedCustomers ?? [])].find(
      (customer) => customer.name === form.customerName,
    )?.id ?? null;

  // Scope the property picker to the selected customer so it lists that
  // customer's properties instead of the first page of everyone's.
  useEffect(() => {
    if (!role || !selectedCustomerId) return;
    let cancelled = false;
    void requestJson<{ properties: Property[] }>(
      `/api/properties?customerId=${encodeURIComponent(selectedCustomerId)}`,
      { role },
    )
      .then((res) => {
        if (!cancelled) {
          setScopedPropertiesState({
            customerId: selectedCustomerId,
            properties: res.properties ?? [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScopedPropertiesState({ customerId: selectedCustomerId, properties: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [role, selectedCustomerId]);

  const scopedProperties =
    scopedPropertiesState && scopedPropertiesState.customerId === selectedCustomerId
      ? scopedPropertiesState.properties
      : null;

  useEffect(() => {
    if (context?.propertyId) {
      setSelectedPropertyId(context.propertyId);
      return;
    }
    if (!form.propertyName) return;
    const match =
      propertyOptions.find((property) => property.name === form.propertyName) ??
      scopedProperties?.find((property) => property.name === form.propertyName) ??
      null;
    if (match) setSelectedPropertyId(match.id);
  }, [context?.propertyId, form.propertyName, propertyOptions, scopedProperties]);

  // Property search runs server-side too, scoped to the selected customer
  // when the form knows it.
  useEffect(() => {
    if (!role) return;
    const query = propertySearch.trim();
    if (!query) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const scope = selectedCustomerId
        ? `customerId=${encodeURIComponent(selectedCustomerId)}&`
        : "";
      void requestJson<{ properties: Property[] }>(
        `/api/properties?${scope}search=${encodeURIComponent(query)}`,
        { role },
      )
        .then((res) => {
          if (!cancelled) {
            setPropertySearchResults({
              query,
              scope: selectedCustomerId,
              properties: res.properties ?? [],
            });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPropertySearchResults({
              query,
              scope: selectedCustomerId,
              properties: [],
            });
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [propertySearch, role, selectedCustomerId]);

  const trimmedPropertySearch = propertySearch.trim();
  const searchedProperties =
    trimmedPropertySearch &&
    propertySearchResults &&
    propertySearchResults.query === trimmedPropertySearch &&
    propertySearchResults.scope === selectedCustomerId
      ? propertySearchResults.properties
      : null;

  const isEdit = Boolean(system);
  const lockJobProperty = role === "tech" && Boolean(context?.propertyName || context?.propertyId);
  const propertySource = searchedProperties ?? scopedProperties ?? propertyOptions;
  const visibleProperties = lockJobProperty
    ? propertySource.filter(
        (property) =>
          (context?.propertyId && property.id === context.propertyId) ||
          (context?.propertyName && property.name === context.propertyName),
      )
    : propertySource;
  const cancelHref = isEdit
    ? ROUTE_BUILDERS.INSTALLED_SYSTEM_DETAIL(system!.id)
    : context?.jobId ? ROUTE_BUILDERS.JOB_DETAIL(context.jobId) : ROUTES.INSTALLED_SYSTEMS;

  function isFormValid(f: FormValues): boolean {
    return (
      f.systemName.trim().length > 0 &&
      f.manufacturer.trim().length > 0 &&
      f.modelNumber.trim().length > 0 &&
      f.serialNumber.trim().length > 0 &&
      isInstallDateValueValid(f.installDate) &&
      f.customerName.trim().length > 0 &&
      f.propertyName.trim().length > 0
    );
  }

  const canSubmit = isFormValid(form);

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(): boolean {
    const errors: Partial<Record<keyof FormValues, string>> = {};
    if (!form.systemName.trim()) errors.systemName = "System name is required.";
    if (!form.manufacturer.trim()) errors.manufacturer = "Manufacturer is required.";
    if (!form.modelNumber.trim()) errors.modelNumber = "Model number is required.";
    if (!form.serialNumber.trim()) errors.serialNumber = "Serial number is required.";
    if (!isInstallDateValueValid(form.installDate))
      errors.installDate = "Enter a year (2024) or a full date (2024-06-15).";
    if (!form.customerName.trim()) errors.customerName = "Customer name is required.";
    if (!form.propertyName.trim()) errors.propertyName = "Property name is required.";
    setFieldErrors(errors);
    return isFormValid(form);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!validate()) {
      setError("Complete all required fields before saving.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const serialNumbers = [form.serialNumber.trim()].filter(Boolean);

      if (isEdit && system) {
        await requestJson(`/api/installed-systems/${system.id}`, {
          method: "PATCH",
          role,
          body: {
            systemName: form.systemName.trim(),
            manufacturer: form.manufacturer.trim(),
            modelNumber: form.modelNumber.trim(),
            serialNumbers,
            warrantyExpiry: canEditWarranty ? form.warrantyExpiry.trim() : undefined,
            customerName: form.customerName.trim(),
            propertyId: selectedPropertyId ?? undefined,
            propertyName: form.propertyName.trim(),
            location: form.location.trim(),
            installDate: form.installDate,
            lifecycleStatus: form.lifecycleStatus,
          },
        });
        await refreshSystems();
        router.push(ROUTE_BUILDERS.INSTALLED_SYSTEM_DETAIL(system.id));
      } else {
        const response = await requestJson<{
          installedSystem: InstalledSystem;
          manualMatch?: { action: "linked" | "suggested" | "none"; reason: string } | null;
        }>(
          "/api/installed-systems",
          {
            method: "POST",
            role,
            body: {
              systemName: form.systemName.trim(),
              manufacturer: form.manufacturer.trim(),
              modelNumber: form.modelNumber.trim(),
              serialNumbers,
              warrantyExpiry: canEditWarranty ? form.warrantyExpiry.trim() : "",
              customerName: form.customerName.trim(),
              propertyId: selectedPropertyId ?? context?.propertyId,
              propertyName: form.propertyName.trim(),
              location: form.location.trim(),
              installDate: form.installDate,
              lifecycleStatus: form.lifecycleStatus,
              jobId: context?.jobId,
              jobNumber: context?.jobNumber,
            },
          },
        );
        await refreshSystems();
        // #8 Copilot: say which Drive manual was linked or suggested, and why.
        if (response.manualMatch && response.manualMatch.action !== "none") {
          pushToast(response.manualMatch.reason, "success");
        }
        if (onCreated) {
          // Dialog mode: hand the new system back to the caller (which closes
          // the dialog). The provider refresh above already makes it visible in
          // the job Systems tab and flips the closeout "Installed systems" gate.
          onCreated(response.installedSystem);
        } else {
          router.push(ROUTE_BUILDERS.INSTALLED_SYSTEM_DETAIL(response.installedSystem.id));
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {embedded ? null : (
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
              <Cpu className="h-3.5 w-3.5" />
              {isEdit ? "Edit System" : "New Installed System"}
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {isEdit ? system!.systemName : "Create Installed System"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {isEdit
                  ? "Update system details. Technical profile and catalog matching are managed separately."
                  : "Register a new installed system. Technical profile and catalog matching will be configured after creation."}
              </p>
            </div>

            {context?.jobNumber ? (
              <p className="text-sm text-slate-400">
                Linked to job{" "}
                <span className="font-medium text-slate-200">{context.jobNumber}</span>
              </p>
            ) : null}
          </div>

          <Link href={cancelHref}>
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              Cancel
            </Button>
          </Link>
        </div>
      </SurfaceCard>
      )}

      <form onSubmit={handleSubmit}>
        <SurfaceCard>
          <div className="grid gap-6 p-6 lg:grid-cols-2">
            {/* System Name */}
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium text-slate-200">
                System Name <span className="text-red-400">*</span>
              </label>
              <input
                value={form.systemName}
                onChange={(e) => updateField("systemName", e.target.value)}
                placeholder="Mitsubishi Hyper Heat – Unit A"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
              {fieldErrors.systemName ? (
                <p className="text-xs text-red-400">{fieldErrors.systemName}</p>
              ) : null}
            </div>

            {/* Manufacturer */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Manufacturer <span className="text-red-400">*</span>
              </label>
              <input
                value={form.manufacturer}
                onChange={(e) => updateField("manufacturer", e.target.value)}
                placeholder="Mitsubishi, Daikin, Carrier…"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
              {fieldErrors.manufacturer ? (
                <p className="text-xs text-red-400">{fieldErrors.manufacturer}</p>
              ) : null}
            </div>

            {/* Model Number */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Model Number <span className="text-red-400">*</span>
              </label>
              <input
                value={form.modelNumber}
                onChange={(e) => updateField("modelNumber", e.target.value)}
                placeholder="MXZ-3C24NAHZ2"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
              {fieldErrors.modelNumber ? (
                <p className="text-xs text-red-400">{fieldErrors.modelNumber}</p>
              ) : null}
            </div>

            {/* Serial Number */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Serial Number <span className="text-red-400">*</span>
              </label>
              <input
                value={form.serialNumber}
                onChange={(e) => updateField("serialNumber", e.target.value)}
                placeholder="SN-2024-001234"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
              {fieldErrors.serialNumber ? (
                <p className="text-xs text-red-400">{fieldErrors.serialNumber}</p>
              ) : null}
            </div>

            {/* Install Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Install Date <span className="text-red-400">*</span>
              </label>
              <input
                value={form.installDate}
                onChange={(e) => updateField("installDate", e.target.value)}
                placeholder="2024 or 2024-06-15"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
              <p className="text-xs text-slate-500">
                Year is enough if that&apos;s all the caller knows.
              </p>
              {fieldErrors.installDate ? (
                <p className="text-xs text-red-400">{fieldErrors.installDate}</p>
              ) : null}
            </div>

            {/* Warranty Expiry — office-only; never shown/required for installers. */}
            {canEditWarranty ? (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  Warranty Expiry <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  type="date"
                  value={form.warrantyExpiry}
                  onChange={(e) => updateField("warrantyExpiry", e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
                />
                <p className="text-xs text-slate-500">
                  Leave blank until the office registers the warranty.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Warranty Expiry</label>
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
                  Set by the office after warranty registration — not required here.
                </p>
              </div>
            )}

            {/* Customer Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Customer <span className="text-red-400">*</span>
              </label>
              {customerDirectoryFailed ? (
                <>
                  <input
                    value={form.customerName}
                    onChange={(e) => updateField("customerName", e.target.value)}
                    placeholder="Customer name"
                    aria-label="Customer name"
                    disabled={lockJobProperty}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40 disabled:opacity-70"
                    required
                  />
                  <p className="text-xs text-slate-500">
                    Customer list unavailable — type the name as it should appear.
                  </p>
                </>
              ) : (
              <>
              <input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search customers…"
                aria-label="Search customers"
                disabled={lockJobProperty}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40 disabled:opacity-70"
              />
              <select
                value={form.customerName}
                onChange={(e) => {
                  updateField("customerName", e.target.value);
                  if (!lockJobProperty) {
                    updateField("propertyName", "");
                    setSelectedPropertyId(null);
                  }
                }}
                disabled={lockJobProperty}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40 disabled:opacity-70"
                required
              >
                <option value="">Select a customer…</option>
                {visibleCustomerOptions.map((customer) => (
                  <option key={customer.id} value={customer.name}>
                    {customer.name}
                  </option>
                ))}
                {form.customerName &&
                !visibleCustomerOptions.some((customer) => customer.name === form.customerName) ? (
                  <option value={form.customerName}>{form.customerName}</option>
                ) : null}
              </select>
              {searchedCustomers !== null && searchedCustomers.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No customers match that search.
                </p>
              ) : null}
              </>
              )}
              {fieldErrors.customerName ? (
                <p className="text-xs text-red-400">{fieldErrors.customerName}</p>
              ) : null}
            </div>

            {/* Property Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Property <span className="text-red-400">*</span>
              </label>
              {propertyDirectoryFailed ? (
                <>
                  <input
                    value={form.propertyName}
                    onChange={(e) => updateField("propertyName", e.target.value)}
                    placeholder="Property name"
                    aria-label="Property name"
                    disabled={lockJobProperty}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40 disabled:opacity-70"
                    required
                  />
                  <p className="text-xs text-slate-500">
                    Property list unavailable — type the name as it should appear.
                  </p>
                </>
              ) : (
              <>
              <input
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
                placeholder="Search properties…"
                aria-label="Search properties"
                disabled={lockJobProperty}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40 disabled:opacity-70"
              />
              <select
                value={form.propertyName}
                onChange={(e) => {
                  const name = e.target.value;
                  updateField("propertyName", name);
                  const match =
                    visibleProperties.find((property) => property.name === name) ??
                    propertySource.find((property) => property.name === name) ??
                    null;
                  setSelectedPropertyId(match?.id ?? (name ? selectedPropertyId : null));
                }}
                disabled={lockJobProperty}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40 disabled:opacity-70"
                required
              >
                <option value="">Select a property…</option>
                {visibleProperties.map((property) => (
                  <option key={property.id} value={property.name}>
                    {property.name}
                  </option>
                ))}
                {form.propertyName &&
                !visibleProperties.some((property) => property.name === form.propertyName) ? (
                  <option value={form.propertyName}>{form.propertyName}</option>
                ) : null}
              </select>
              {searchedProperties !== null && searchedProperties.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No properties match that search.
                </p>
              ) : null}
              </>
              )}
              {fieldErrors.propertyName ? (
                <p className="text-xs text-red-400">{fieldErrors.propertyName}</p>
              ) : null}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Location</label>
              <input
                value={form.location}
                onChange={(e) => updateField("location", e.target.value)}
                placeholder="Rooftop – North Wing"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
              />
            </div>

            {/* Lifecycle Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Lifecycle Status</label>
              <select
                value={form.lifecycleStatus}
                onChange={(e) =>
                  updateField("lifecycleStatus", e.target.value as InstalledSystemLifecycle)
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
              >
                {LIFECYCLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            {error ? <p className="text-sm text-red-300">{error}</p> : <div />}
            <div className="flex items-center justify-end gap-3">
              {onCancel ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onCancel}
                  disabled={isSaving}
                  className="text-slate-300 hover:text-white"
                >
                  Cancel
                </Button>
              ) : (
                <Link href={cancelHref}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-slate-300 hover:text-white"
                  >
                    Cancel
                  </Button>
                </Link>
              )}

              <Button type="submit" className="gap-2" disabled={!canSubmit || isSaving}>
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : isEdit ? "Save Changes" : "Create System"}
              </Button>
            </div>
          </div>
        </SurfaceCard>
      </form>
    </div>
  );
}
