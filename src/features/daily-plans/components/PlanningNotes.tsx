"use client";

import { useCallback, useState } from "react";
import { FileText, Save } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useDailyPlans } from "../state/DailyPlansProvider";
import { formatDateShort } from "../utils/planUtils";

interface PlanningNotesProps {
  date: string;
}

export function PlanningNotes({ date }: PlanningNotesProps) {
  const { getNote, saveNote } = useDailyPlans();
  const [draft, setDraft] = useState(() => getNote(date));
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    saveNote(date, draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [date, draft, saveNote]);

  const currentSavedNote = getNote(date);
  const isDirty = draft !== currentSavedNote;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500/15 to-slate-500/5 ring-1 ring-white/10">
            <FileText className="h-4 w-4 text-slate-300" />
          </div>

          <div>
            <p className="text-sm font-semibold text-white">Morning Meeting Notes</p>
            <p className="text-xs text-slate-400">{formatDateShort(date)}</p>
          </div>
        </div>

        {isDirty || saved ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave}
            className={[
              "h-8 gap-1.5 rounded-xl px-3 text-xs font-medium transition-all",
              saved
                ? "border border-green-500/20 bg-green-500/10 text-green-300 hover:bg-green-500/15"
                : "border border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/10",
            ].join(" ")}
          >
            <Save className="h-3.5 w-3.5" />
            {saved ? "Saved" : "Save"}
          </Button>
        ) : null}
      </div>

      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={`Add notes for ${formatDateShort(date)}…

Examples:
• Customer has aggressive dog.
• Garage code 1432.
• Neighbor driveway only — do not block.
• Helper picking up special order parts at 7:15.`}
        rows={8}
        className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 transition focus:border-blue-500/30 focus:bg-white/[0.06]"
      />
    </div>
  );
}
