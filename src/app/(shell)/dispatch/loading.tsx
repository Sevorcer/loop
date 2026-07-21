import { LoadingState } from "@/components/atlas";

export default function DispatchLoading() {
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero skeleton */}
      <div className="h-32 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03] sm:h-40" />

      {/* Board skeleton */}
      <div className="space-y-6">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-4 w-4 animate-pulse rounded-full bg-white/10" />
          <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
        </div>
        <LoadingState message="Loading dispatch board..." />
      </div>
    </div>
  );
}
