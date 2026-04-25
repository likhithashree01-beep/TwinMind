"use client";

import { useSession } from "@/lib/store";

export function ErrorBanner() {
  const error = useSession((s) => s.error);
  const setError = useSession((s) => s.setError);
  if (!error) return null;
  return (
    <div className="mx-6 mb-3 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[13px] text-red-200">
      <span className="mt-0.5">⚠</span>
      <span className="flex-1 leading-relaxed">{error}</span>
      <button
        type="button"
        onClick={() => setError(null)}
        className="text-[12px] text-red-300/80 hover:text-red-100"
      >
        Dismiss
      </button>
    </div>
  );
}
