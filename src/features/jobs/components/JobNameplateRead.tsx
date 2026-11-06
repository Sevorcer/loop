"use client";

import { useState } from "react";
import { Loader2, ScanLine } from "lucide-react";
import { useRouter } from "next/navigation";

import { PermissionGuard } from "@/components/atlas";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import { useInstalledSystems } from "@/features/installed-systems/state/InstalledSystemsProvider";
import {
  reviewFromExtraction,
  type NameplateExtraction,
  type NameplateReview,
} from "@/features/installed-systems/utils/nameplateRead";
import { ApiRequestError, requestJson } from "@/lib/api/client";

interface NameplateSystemOption {
  id: string;
  systemName: string;
  modelNumber: string;
  serialNumber: string;
}

interface NameplateSearchResponse {
  saved: false;
  review: NameplateReview;
  extraction: NameplateExtraction;
  photoFileName: string | null;
  systems: NameplateSystemOption[];
}

export function JobNameplateRead({ jobId }: { jobId: string }) {
  const router = useRouter();
  const { role } = useCurrentRole();
  const { refreshSystems } = useInstalledSystems();
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<NameplateExtraction | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);
  const [systems, setSystems] = useState<NameplateSystemOption[]>([]);
  const [systemId, setSystemId] = useState("");
  const [review, setReview] = useState<NameplateReview | null>(null);
  const [draftModel, setDraftModel] = useState("");
  const [draftSerial, setDraftSerial] = useState("");

  function applySystem(nextSystems: NameplateSystemOption[], nextExtraction: NameplateExtraction, nextSystemId: string) {
    const selected = nextSystems.find((system) => system.id === nextSystemId) ?? null;
    const nextReview = reviewFromExtraction({
      existingModel: selected?.modelNumber ?? "",
      existingSerial: selected?.serialNumber ?? "",
      extraction: nextExtraction,
    });
    setReview(nextReview);
    if (nextReview.status === "proposed") {
      setDraftModel(nextReview.modelNumber ?? "");
      setDraftSerial(nextReview.serialNumber ?? "");
    } else {
      setDraftModel("");
      setDraftSerial("");
    }
  }

  async function search() {
    if (!role) return;
    setSearching(true);
    setError(null);
    setSavedNote(null);
    try {
      const response = await requestJson<NameplateSearchResponse>(`/api/jobs/${jobId}/nameplate`, {
        method: "POST",
        role,
        body: {},
      });
      const nextSystems = response.systems ?? [];
      const nextSystemId = nextSystems.length === 1 ? nextSystems[0].id : "";
      setSystems(nextSystems);
      setSystemId(nextSystemId);
      setExtraction(response.extraction);
      setPhotoFileName(response.photoFileName);
      if (response.review.status === "unreadable") {
        setReview(response.review);
        setDraftModel("");
        setDraftSerial("");
      } else {
        applySystem(nextSystems, response.extraction, nextSystemId);
      }
    } catch (searchError) {
      setReview(null);
      setError(searchError instanceof Error ? searchError.message : "No nameplate was found.");
    } finally {
      setSearching(false);
    }
  }

  function onChooseSystem(nextId: string) {
    setSystemId(nextId);
    if (extraction && extraction.status === "read") {
      applySystem(systems, extraction, nextId);
    }
  }

  async function confirmSave() {
    if (!role) return;
    setSaving(true);
    setError(null);
    try {
      await requestJson(`/api/jobs/${jobId}/nameplate`, {
        method: "POST",
        role,
        body: {
          confirm: true,
          modelNumber: draftModel,
          serialNumber: draftSerial,
          ...(systemId ? { installedSystemId: systemId } : {}),
        },
      });
      setReview(null);
      setExtraction(null);
      setSavedNote("Saved onto the installed system. Model and serial match what you confirmed.");
      await refreshSystems();
      router.refresh();
    } catch (saveError) {
      const message = saveError instanceof ApiRequestError
        ? saveError.message
        : saveError instanceof Error
          ? saveError.message
          : "Nothing was saved.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  const needsChoice = systems.length > 1;
  const selected = systems.find((system) => system.id === systemId) ?? null;

  return (
    <PermissionGuard table="jobs" action="update">
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={searching}
            onClick={() => void search()}
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            Find nameplate
          </Button>
          <p className="text-xs text-slate-500">
            Searches the photos already on this job. Nothing is saved until you confirm.
          </p>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {savedNote ? <p className="text-sm text-emerald-200">{savedNote}</p> : null}

        {review?.status === "unreadable" ? (
          <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100" role="status">
            {review.message}
          </p>
        ) : null}

        {review?.status === "proposed" ? (
          <form
            className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void confirmSave();
            }}
          >
            <p className="text-sm text-slate-300" role="status">
              {review.message}
              {photoFileName ? ` From ${photoFileName}.` : ""}
            </p>
            {systems.length === 0 ? (
              <p className="text-sm text-amber-100">
                This job has no installed system yet, so these values cannot be saved.
              </p>
            ) : null}
            {systems.length === 1 && selected ? (
              <p className="text-xs text-slate-500">Saves to {selected.systemName}.</p>
            ) : null}
            {needsChoice ? (
              <label className="block space-y-2 text-sm">
                <span className="font-medium text-slate-200">Installed system</span>
                <select
                  value={systemId}
                  onChange={(event) => onChooseSystem(event.target.value)}
                  aria-label="Installed system"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
                >
                  <option value="">Choose a system…</option>
                  {systems.map((system) => (
                    <option key={system.id} value={system.id}>
                      {system.systemName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-200">Model</span>
                {selected?.modelNumber ? (
                  <span className="block text-xs text-slate-500">Current: {selected.modelNumber}</span>
                ) : null}
                <input
                  value={draftModel}
                  onChange={(event) => setDraftModel(event.target.value)}
                  aria-label="Suggested model number"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
                />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-200">Serial</span>
                {selected?.serialNumber ? (
                  <span className="block text-xs text-slate-500">Current: {selected.serialNumber}</span>
                ) : null}
                <input
                  value={draftSerial}
                  onChange={(event) => setDraftSerial(event.target.value)}
                  aria-label="Suggested serial number"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                size="sm"
                disabled={saving || systems.length === 0 || (needsChoice && !systemId) || !draftModel.trim() || !draftSerial.trim()}
              >
                {saving ? "Saving…" : "Save model and serial"}
              </Button>
              <button
                type="button"
                className="text-sm text-slate-400 transition hover:text-slate-200"
                onClick={() => {
                  setReview(null);
                  setExtraction(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </PermissionGuard>
  );
}
