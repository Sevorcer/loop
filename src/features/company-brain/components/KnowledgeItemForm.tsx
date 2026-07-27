"use client";

import { useState } from "react";
import { Brain, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/api/client";
import { useCurrentRole } from "@/features/auth";
import { ROUTES } from "@/lib/routes";

import type {
  KnowledgeItem,
  KnowledgeStatus,
  KnowledgeType,
} from "../types/knowledgeItem";

const KNOWLEDGE_TYPES: { value: KnowledgeType; label: string }[] = [
  { value: "sop", label: "SOP" },
  { value: "installation_guide", label: "Installation Guide" },
  { value: "service_bulletin", label: "Service Bulletin" },
  { value: "troubleshooting", label: "Troubleshooting" },
  { value: "safety_procedure", label: "Safety Procedure" },
  { value: "best_practice", label: "Best Practice" },
  { value: "policy", label: "Policy" },
  { value: "training", label: "Training" },
  { value: "faq", label: "FAQ" },
];

const KNOWLEDGE_STATUSES: { value: KnowledgeStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "reviewed", label: "Reviewed" },
  { value: "published", label: "Published" },
  { value: "improved", label: "Improved" },
  { value: "archived", label: "Archived" },
];

interface FormValues {
  title: string;
  summary: string;
  body: string;
  knowledgeType: KnowledgeType;
  status: KnowledgeStatus;
  owner: string;
  tagsRaw: string;
}

function toFormValues(item?: KnowledgeItem): FormValues {
  return {
    title: item?.title ?? "",
    summary: item?.summary ?? "",
    body: item?.body ?? "",
    knowledgeType: item?.knowledgeType ?? "sop",
    status: item?.status ?? "draft",
    owner: item?.owner ?? "Team",
    tagsRaw: item?.tags.join(", ") ?? "",
  };
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

interface KnowledgeItemFormProps {
  item?: KnowledgeItem;
  onSaved?: () => void;
}

export function KnowledgeItemForm({ item, onSaved }: KnowledgeItemFormProps) {
  const router = useRouter();
  const { role } = useCurrentRole();
  const [form, setForm] = useState<FormValues>(toFormValues(item));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isEdit = Boolean(item);
  const cancelHref = ROUTES.COMPANY_BRAIN;

  const canSubmit =
    form.title.trim().length > 0 && form.summary.trim().length > 0;

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canSubmit) {
      setError("Title and summary are required.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        body: form.body.trim(),
        knowledgeType: form.knowledgeType,
        status: form.status,
        owner: form.owner.trim() || "Team",
        tags: parseTags(form.tagsRaw),
      };

      if (isEdit && item) {
        await requestJson(`/api/knowledge-items/${item.id}`, {
          method: "PATCH",
          role,
          body: payload,
        });
      } else {
        await requestJson("/api/knowledge-items", {
          method: "POST",
          role,
          body: payload,
        });
      }

      if (onSaved) {
        onSaved();
      } else {
        router.push(ROUTES.COMPANY_BRAIN);
        router.refresh();
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
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
              <Brain className="h-3.5 w-3.5" />
              {isEdit ? "Edit Knowledge" : "New Knowledge Item"}
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {isEdit ? item!.title : "Create Knowledge Item"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {isEdit
                  ? "Update this knowledge item. Status changes propagate immediately to operational consumers."
                  : "Capture company knowledge in a structured, reusable format."}
              </p>
            </div>
          </div>

          <Link href={cancelHref}>
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              Cancel
            </Button>
          </Link>
        </div>
      </SurfaceCard>

      <form onSubmit={handleSubmit}>
        <SurfaceCard>
          <div className="grid gap-6 p-6 lg:grid-cols-2">
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium text-slate-200">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Mini-split startup sequence"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-violet-500/40"
                required
              />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium text-slate-200">
                Summary <span className="text-red-400">*</span>
              </label>
              <input
                value={form.summary}
                onChange={(e) => updateField("summary", e.target.value)}
                placeholder="A brief one-to-two sentence description of what this knowledge covers"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-violet-500/40"
                required
              />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium text-slate-200">Body</label>
              <textarea
                value={form.body}
                onChange={(e) => updateField("body", e.target.value)}
                rows={8}
                placeholder="Full knowledge content — procedures, checklists, lessons learned..."
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-violet-500/40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Knowledge Type</label>
              <select
                value={form.knowledgeType}
                onChange={(e) =>
                  updateField("knowledgeType", e.target.value as KnowledgeType)
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-violet-500/40"
              >
                {KNOWLEDGE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  updateField("status", e.target.value as KnowledgeStatus)
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-violet-500/40"
              >
                {KNOWLEDGE_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Owner</label>
              <input
                value={form.owner}
                onChange={(e) => updateField("owner", e.target.value)}
                placeholder="Team"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-violet-500/40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Tags</label>
              <input
                value={form.tagsRaw}
                onChange={(e) => updateField("tagsRaw", e.target.value)}
                placeholder="mini-split, startup, commissioning"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-violet-500/40"
              />
              <p className="text-xs text-slate-500">Comma-separated</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            {error ? <p className="text-sm text-red-300">{error}</p> : <div />}
            <div className="flex items-center justify-end gap-3">
              <Link href={cancelHref}>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-300 hover:text-white"
                >
                  Cancel
                </Button>
              </Link>

              <Button type="submit" className="gap-2" disabled={!canSubmit || isSaving}>
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : isEdit ? "Save Changes" : "Create Knowledge"}
              </Button>
            </div>
          </div>
        </SurfaceCard>
      </form>
    </div>
  );
}
