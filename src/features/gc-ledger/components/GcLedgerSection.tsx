"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  DollarSign,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

import type {
  GcLedgerEntry,
  GcChangeOrder,
  GcBuilderRollup,
  GcContact,
} from "../types/gcLedger";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCents(cents: number | null): string {
  if (cents === null || cents === undefined) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(value: string | null): string {
  if (!value) return "--";
  return value;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GcLedgerSectionProps {
  customerId: string;
  customerName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GcLedgerSection({ customerId, customerName }: GcLedgerSectionProps) {
  const [entries, setEntries] = useState<GcLedgerEntry[]>([]);
  const [rollup, setRollup] = useState<GcBuilderRollup | null>(null);
  const [contacts, setContacts] = useState<GcContact[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(() => true);
    setError(() => null);
    try {
      const [entriesRes, overviewRes, contactsRes] = await Promise.all([
        fetch(`/api/customers/${customerId}/gc-ledger`),
        fetch(`/api/gc-overview`),
        fetch(`/api/customers/${customerId}/contacts`),
      ]);

      if (entriesRes.ok) {
        const { entries: fetchedEntries } = await entriesRes.json();
        setEntries(() => fetchedEntries ?? []);
      }

      if (overviewRes.ok) {
        const { builders } = await overviewRes.json();
        const builderRollup = (builders ?? []).find(
          (b: GcBuilderRollup) => b.customerId === customerId,
        );
        if (builderRollup) setRollup(() => builderRollup);
      }

      if (contactsRes.ok) {
        const { contacts: fetchedContacts } = await contactsRes.json();
        setContacts(() => fetchedContacts ?? []);
      }
    } catch {
      setError(() => "Failed to load GC ledger data.");
    } finally {
      setLoading(() => false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleRow = (entryId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const superContact = contacts.find((c) => c.role === "super");
  const pmContact = contacts.find((c) => c.role === "pm");

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">GC Tracking Ledger</h2>
        <div className="flex items-center justify-center rounded-xl border bg-card p-8 text-muted-foreground">
          Loading ledger...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">GC Tracking Ledger</h2>
        <div className="rounded-xl border border-destructive/20 bg-card p-6 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">GC Tracking Ledger</h2>
      </div>

      {/* Roll-up stats */}
      {rollup ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total Billed
              </p>
              <p className="mt-1 text-xl font-semibold text-primary">
                {formatCents(rollup.totalBilledCents)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Total Outstanding
              </p>
              <p className="mt-1 text-xl font-semibold text-amber-400">
                {formatCents(rollup.totalOutstandingCents)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Retainer Held
              </p>
              <p className="mt-1 text-xl font-semibold">
                {formatCents(rollup.totalRetainerCents)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Open Callbacks
              </p>
              <p className="mt-1 text-xl font-semibold">
                {rollup.callbackCount}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Contacts */}
      {(superContact || pmContact) ? (
        <div className="flex flex-wrap gap-4 text-sm">
          {superContact ? (
            <div className="rounded-lg border bg-surface-elevated/50 px-3 py-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Super</span>
              <p className="font-medium">{superContact.name}</p>
              {superContact.phone ? <p className="text-muted-foreground">{superContact.phone}</p> : null}
              {superContact.email ? <p className="text-muted-foreground">{superContact.email}</p> : null}
            </div>
          ) : null}
          {pmContact ? (
            <div className="rounded-lg border bg-surface-elevated/50 px-3 py-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">PM</span>
              <p className="font-medium">{pmContact.name}</p>
              {pmContact.phone ? <p className="text-muted-foreground">{pmContact.phone}</p> : null}
              {pmContact.email ? <p className="text-muted-foreground">{pmContact.email}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Ledger table */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No ledger entries yet. Create one when a job is started under this builder.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="w-8 p-3" />
                <th className="p-3">Homeowner</th>
                <th className="p-3">Site Address</th>
                <th className="p-3">Job #</th>
                <th className="p-3">Est #</th>
                <th className="p-3 text-right">Price</th>
                <th className="p-3">Invoice #</th>
                <th className="p-3">GC P.O. #</th>
                <th className="p-3">Date Sent</th>
                <th className="p-3">Date Received</th>
                <th className="p-3 text-right">Balance</th>
                <th className="p-3 text-right">Retainer</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isExpanded = expandedRows.has(entry.id);
                const coTotal = entry.changeOrders.reduce(
                  (sum, co) => sum + co.amountCents,
                  0,
                );

                return (
                  <LedgerRow
                    key={entry.id}
                    entry={entry}
                    isExpanded={isExpanded}
                    coTotal={coTotal}
                    onToggle={() => toggleRow(entry.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ledger row (with expandable change orders)
// ---------------------------------------------------------------------------

function LedgerRow({
  entry,
  isExpanded,
  coTotal,
  onToggle,
}: {
  entry: GcLedgerEntry;
  isExpanded: boolean;
  coTotal: number;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="border-b transition-colors hover:bg-muted/20 cursor-pointer"
        onClick={onToggle}
      >
        <td className="p-3">
          {entry.changeOrders.length > 0 ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )
          ) : (
            <span className="inline-block h-4 w-4" />
          )}
        </td>
        <td className="p-3 font-medium">{entry.homeownerName ?? "--"}</td>
        <td className="p-3 text-muted-foreground">{entry.siteAddress ?? "--"}</td>
        <td className="p-3">{entry.jobNumber ?? "--"}</td>
        <td className="p-3">{entry.estimateNumber || "--"}</td>
        <td className="p-3 text-right tabular-nums">{formatCents(entry.priceCents)}</td>
        <td className="p-3">{entry.invoiceNumber || "--"}</td>
        <td className="p-3">{entry.gcPoNumber || "--"}</td>
        <td className="p-3">{formatDate(entry.dateSent)}</td>
        <td className="p-3">{formatDate(entry.dateReceived)}</td>
        <td className="p-3 text-right tabular-nums">{formatCents(entry.balanceCents)}</td>
        <td className="p-3 text-right tabular-nums">{formatCents(entry.retainerCents)}</td>
      </tr>
      {isExpanded && entry.changeOrders.length > 0 ? (
        <>
          {entry.changeOrders.map((co) => (
            <tr key={co.id} className="border-b bg-muted/10 text-xs">
              <td className="p-2" />
              <td className="p-2 pl-8" colSpan={4}>
                <span className="text-muted-foreground">CO #{co.changeOrderNumber || "--"}</span>
                {co.description ? (
                  <span className="ml-2 text-muted-foreground/70">{co.description}</span>
                ) : null}
              </td>
              <td className="p-2 text-right tabular-nums" colSpan={1}>
                {formatCents(co.amountCents)}
              </td>
              <td colSpan={6} />
            </tr>
          ))}
          <tr className="border-b bg-muted/10 text-xs font-medium">
            <td className="p-2" />
            <td className="p-2 pl-8" colSpan={4}>
              Change Orders Total
            </td>
            <td className="p-2 text-right tabular-nums" colSpan={1}>
              {formatCents(coTotal)}
            </td>
            <td colSpan={6} />
          </tr>
        </>
      ) : null}
    </>
  );
}
