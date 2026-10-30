"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Loader2, PenLine } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";
import { companyTimeZone } from "@/lib/timezone";

import type { JobSignature } from "../types/jobSignature";
import {
  canCaptureSignature,
  formatSignatureCaption,
  signatureCaptureError,
} from "../utils/jobSignature";

function prepareCanvas(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, rect.width, rect.height);
  context.strokeStyle = "#111827";
  context.lineWidth = 2.5;
  context.lineCap = "round";
  context.lineJoin = "round";
  return context;
}

export function JobSignatureCard({
  jobId,
  onLatestChange,
}: {
  jobId: string;
  onLatestChange?: (signature: JobSignature | null) => void;
}) {
  const { role } = useCurrentRole();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [signerName, setSignerName] = useState("");
  const [signatures, setSignatures] = useState<JobSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enlarged, setEnlarged] = useState(false);

  const latest = signatures[0] ?? null;
  const canCapture = canCaptureSignature(role);
  const zone = companyTimeZone();

  const loadSignatures = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    try {
      const response = await requestJson<{ signatures: JobSignature[] }>(
        `/api/jobs/${jobId}/signature`,
        { role, cache: "no-store" },
      );
      const next = response.signatures ?? [];
      setSignatures(next);
      onLatestChange?.(next[0] ?? null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Couldn't load the signature.");
    } finally {
      setLoading(false);
    }
  }, [jobId, onLatestChange, role]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadSignatures();
    });
  }, [loadSignatures]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canCapture) return;
    hasInk.current = false;
    const drawBlank = () => {
      if (hasInk.current) return;
      prepareCanvas(canvas);
    };
    drawBlank();
    const observer = new ResizeObserver(() => {
      drawBlank();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canCapture, latest?.id]);

  function pointerPosition(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function startDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const point = pointerPosition(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineTo(point.x + 0.01, point.y + 0.01);
    context.stroke();
    hasInk.current = true;
  }

  function moveDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const point = pointerPosition(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    hasInk.current = true;
  }

  function endDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function clearPad() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    prepareCanvas(canvas);
    hasInk.current = false;
    setError(null);
  }

  async function saveSignature() {
    const validation = signatureCaptureError({ signerName, hasInk: hasInk.current });
    if (validation) {
      setError(validation);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas || !role) return;

    setSaving(true);
    setError(null);
    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((next) => resolve(next), "image/png");
      });
      if (!blob) throw new Error("Couldn't read the signature. Try again.");

      const formData = new FormData();
      formData.set("signerName", signerName.trim());
      formData.set("file", blob, "customer-signature.png");

      const headers = new Headers();
      if (process.env.NODE_ENV !== "production" && role) {
        headers.set("x-loop-role", role);
      }

      const response = await fetch(`/api/jobs/${jobId}/signature`, {
        method: "POST",
        credentials: "include",
        body: formData,
        headers,
      });
      const payload = (await response.json().catch(() => null)) as
        | { message?: string; signature?: JobSignature }
        | null;
      if (!response.ok || !payload?.signature) {
        throw new Error(payload?.message ?? "Couldn't save the signature.");
      }

      setSignatures((current) => [payload.signature as JobSignature, ...current]);
      onLatestChange?.(payload.signature);
      setSignerName("");
      clearPad();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn't save the signature.");
    } finally {
      setSaving(false);
    }
  }

  const caption = latest
    ? formatSignatureCaption({
        signerName: latest.signerName,
        capturedByName: latest.capturedByName,
        capturedAt: latest.capturedAt,
        timeZone: zone,
      })
    : null;

  return (
    <SurfaceCard>
      <div className="p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
            <PenLine className="h-5 w-5 text-slate-200" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Customer signature</h2>
            <p className="mt-1 text-sm text-slate-400">
              Have the customer sign when the work is finished. A finger or a mouse both work.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading signature…
          </div>
        ) : latest ? (
          <div className="mt-4">
            <button
              type="button"
              className="block w-full overflow-hidden rounded-2xl border border-white/10 bg-white"
              onClick={() => latest.previewUrl && setEnlarged(true)}
              disabled={!latest.previewUrl}
            >
              {latest.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={latest.previewUrl}
                  alt={`Signature of ${latest.signerName}`}
                  className="mx-auto max-h-40 w-full object-contain"
                />
              ) : (
                <p className="px-4 py-6 text-sm text-slate-700">Signature saved. Preview is unavailable.</p>
              )}
            </button>
            {caption ? <p className="mt-2 text-sm text-slate-300">{caption}</p> : null}
            {signatures.length > 1 ? (
              <ul className="mt-3 space-y-1">
                {signatures.slice(1).map((signature) => (
                  <li key={signature.id} className="text-xs text-slate-500">
                    {formatSignatureCaption({
                      signerName: signature.signerName,
                      capturedByName: signature.capturedByName,
                      capturedAt: signature.capturedAt,
                      timeZone: zone,
                    })}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No signature yet.</p>
        )}

        {canCapture ? (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-slate-200" htmlFor={`signer-${jobId}`}>
              Name of person signing
            </label>
            <input
              id={`signer-${jobId}`}
              value={signerName}
              onChange={(event) => setSignerName(event.target.value)}
              autoComplete="name"
              placeholder="Customer name"
              className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-white/30"
            />
            <canvas
              ref={canvasRef}
              aria-label="Customer signature"
              className="h-44 w-full touch-none rounded-2xl border border-white/15 bg-white"
              onPointerDown={startDraw}
              onPointerMove={moveDraw}
              onPointerUp={endDraw}
              onPointerCancel={endDraw}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                className="min-h-[48px] flex-1"
                onClick={clearPad}
                disabled={saving}
              >
                <Eraser className="h-4 w-4" />
                Clear
              </Button>
              <Button
                type="button"
                className="min-h-[48px] flex-1"
                onClick={() => void saveSignature()}
                disabled={saving}
              >
                {saving ? "Saving..." : latest ? "Save a new signature" : "Save signature"}
              </Button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {enlarged && latest?.previewUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Signature of ${latest.signerName}`}
          onClick={() => setEnlarged(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={latest.previewUrl}
            alt={`Signature of ${latest.signerName}`}
            className="max-h-[80vh] w-full max-w-3xl rounded-2xl bg-white object-contain"
          />
        </div>
      ) : null}
    </SurfaceCard>
  );
}
