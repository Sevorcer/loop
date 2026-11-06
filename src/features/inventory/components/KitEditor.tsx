"use client";

import { ArrowDown, ArrowUp, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { SectionCard } from "@/components/atlas/SectionCard";
import { StatusBadge } from "@/components/atlas/StatusBadge";
import { Button } from "@/components/ui/button";

import { useInventoryMutation } from "../hooks/useInventoryMutation";
import type { KitItemOption, KitLineInput, KitTemplate } from "../types/kits";
import { normalizeKitLines, sameKitLines, validateKitName } from "../utils/kitRules";
import { FormField } from "./FormField";
import { FormError } from "./FormMessages";
import { KitItemPicker } from "./KitItemPicker";
import { fieldClass } from "./formStyles";

interface EditorLine {
  key: string;
  catalogItemId: string;
  itemName: string;
  sku: string | null;
  unit: string | null;
  itemActive: boolean;
  quantity: string;
  isOptional: boolean;
  notes: string;
}

interface KitEditorProps {
  kit: KitTemplate;
  options: readonly KitItemOption[];
}

function toEditorLines(kit: KitTemplate): EditorLine[] {
  return kit.lines.map((line) => ({
    key: line.id,
    catalogItemId: line.catalogItemId,
    itemName: line.itemName,
    sku: line.sku,
    unit: line.unit,
    itemActive: line.itemActive,
    quantity: String(line.quantity),
    isOptional: line.isOptional,
    notes: line.notes ?? "",
  }));
}

/** Parses typed quantities. A quantity that is not a plain number becomes NaN so validation names the line. */
function toLineInputs(lines: readonly EditorLine[]): unknown[] {
  return lines.map((line) => ({
    catalogItemId: line.catalogItemId,
    quantity: /^\d*\.?\d+$|^\d+\.$/.test(line.quantity.trim()) ? Number(line.quantity.trim()) : Number.NaN,
    isOptional: line.isOptional,
    notes: line.notes,
  }));
}

export function KitEditor({ kit, options }: KitEditorProps) {
  const { run, pending, error, setError } = useInventoryMutation();
  const [name, setName] = useState(kit.name);
  const [category, setCategory] = useState(kit.category ?? "");
  const [description, setDescription] = useState(kit.description ?? "");
  const [lines, setLines] = useState<EditorLine[]>(() => toEditorLines(kit));
  const [saved, setSaved] = useState(false);

  const saveLines = useMemo(() => normalizeKitLines(toLineInputs(lines)), [lines]);
  const originalLines: KitLineInput[] = useMemo(
    () => kit.lines.map((line) => ({ catalogItemId: line.catalogItemId, quantity: line.quantity, isOptional: line.isOptional, notes: line.notes })),
    [kit.lines],
  );

  const headerDirty =
    name.trim() !== kit.name ||
    (category.trim() || null) !== kit.category ||
    (description.trim() || null) !== kit.description;
  // Unparseable lines count as dirty so Save is available and shows the specific error.
  const linesDirty = !saveLines.ok || !sameKitLines(saveLines.value, originalLines);
  const dirty = headerDirty || linesDirty;

  const excluded = useMemo(() => new Set(lines.map((line) => line.catalogItemId)), [lines]);
  const isArchived = kit.status === "archived";

  function touch<T>(setter: (value: T) => void, value: T) {
    setSaved(false);
    setter(value);
  }

  function updateLine(key: string, patch: Partial<EditorLine>) {
    setSaved(false);
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function moveLine(index: number, direction: -1 | 1) {
    setSaved(false);
    setLines((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addItem(option: KitItemOption) {
    setSaved(false);
    setLines((current) => [
      ...current,
      {
        key: `new-${option.id}`,
        catalogItemId: option.id,
        itemName: option.name,
        sku: option.sku,
        unit: option.unit,
        itemActive: true,
        quantity: "1",
        isOptional: false,
        notes: "",
      },
    ]);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    const checkedName = validateKitName(name);
    if (!checkedName.ok) return setError(checkedName.message);
    if (!saveLines.ok) return setError(saveLines.message);

    const result = await run(`/api/inventory/kits/${kit.id}`, "PATCH", {
      name: checkedName.value,
      category: category.trim() || null,
      description: description.trim() || null,
      lines: saveLines.value,
    });
    if (result.ok) setSaved(true);
  }

  async function toggleArchive() {
    setSaved(false);
    await run(`/api/inventory/kits/${kit.id}`, "PATCH", { status: isArchived ? "active" : "archived" });
  }

  return (
    <form onSubmit={save} noValidate className="space-y-6">
      <SectionCard
        title={kit.name}
        description="Version goes up when items or quantities change. Jobs that already used this kit keep their own copy."
        actions={
          <>
            <StatusBadge variant={isArchived ? "neutral" : "success"}>{isArchived ? "Archived" : "Active"}</StatusBadge>
            <StatusBadge variant="neutral">v{kit.version}</StatusBadge>
            <Button type="button" variant="ghost" size="sm" onClick={toggleArchive} disabled={pending}>
              {isArchived ? <ArchiveRestore size={14} aria-hidden="true" /> : <Archive size={14} aria-hidden="true" />}
              {isArchived ? "Restore" : "Archive"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormError message={error} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name" htmlFor="kit-edit-name">
              <input id="kit-edit-name" value={name} onChange={(e) => touch(setName, e.target.value)} className={fieldClass} maxLength={120} />
            </FormField>
            <FormField label="Category (optional)" htmlFor="kit-edit-category">
              <input id="kit-edit-category" value={category} onChange={(e) => touch(setCategory, e.target.value)} className={fieldClass} maxLength={60} />
            </FormField>
          </div>
          <FormField label="Description (optional)" htmlFor="kit-edit-description">
            <textarea id="kit-edit-description" value={description} onChange={(e) => touch(setDescription, e.target.value)} rows={2} className={fieldClass} maxLength={1000} />
          </FormField>
        </div>
      </SectionCard>

      <SectionCard
        title="Items"
        description="Optional items show on the job’s plan but never count as missing."
      >
        <div className="space-y-4">
          {lines.length === 0 ? (
            <p className="text-sm text-muted">No items yet. Search the catalog below to add the first one.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)] rounded-atlas-md border border-default" aria-label="Kit items">
              {lines.map((line, index) => (
                <li key={line.key} className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_6rem_auto] sm:items-start">
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm font-medium text-primary">
                      {line.itemName}
                      {!line.itemActive ? <span className="ml-2 text-xs text-muted">(inactive item)</span> : null}
                    </p>
                    <p className="text-xs text-muted">{[line.sku, line.unit].filter(Boolean).join(" · ") || "No SKU"}</p>
                    <label className="sr-only" htmlFor={`note-${line.key}`}>Note for {line.itemName}</label>
                    <input
                      id={`note-${line.key}`}
                      value={line.notes}
                      onChange={(e) => updateLine(line.key, { notes: e.target.value })}
                      placeholder="Note (optional), like “condensing furnaces only”"
                      className={fieldClass}
                      maxLength={500}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="sr-only" htmlFor={`qty-${line.key}`}>Quantity of {line.itemName}</label>
                    <input
                      id={`qty-${line.key}`}
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      className={fieldClass}
                    />
                    <label className="flex min-h-11 items-center gap-2 text-sm text-muted sm:min-h-0">
                      <input
                        type="checkbox"
                        checked={line.isOptional}
                        onChange={(e) => updateLine(line.key, { isOptional: e.target.checked })}
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                      Optional
                    </label>
                  </div>
                  <div className="flex gap-1 sm:flex-col">
                    <Button type="button" variant="ghost" size="sm" onClick={() => moveLine(index, -1)} disabled={index === 0} aria-label={`Move ${line.itemName} up`}>
                      <ArrowUp size={14} aria-hidden="true" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => moveLine(index, 1)} disabled={index === lines.length - 1} aria-label={`Move ${line.itemName} down`}>
                      <ArrowDown size={14} aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSaved(false);
                        setLines((current) => current.filter((l) => l.key !== line.key));
                      }}
                      aria-label={`Remove ${line.itemName}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <KitItemPicker options={options} excludedIds={excluded} onPick={addItem} />
        </div>
      </SectionCard>

      <div className="flex items-center justify-end gap-3">
        {saved ? <span role="status" className="text-sm text-muted">Saved</span> : null}
        <Button type="submit" disabled={pending || !dirty}>{pending ? "Saving…" : "Save kit"}</Button>
      </div>
    </form>
  );
}
