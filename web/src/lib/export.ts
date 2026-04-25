"use client";

import type { SessionExport } from "./types";
import { useSession } from "./store";

export function downloadSession() {
  const s = useSession.getState();
  const data: SessionExport = {
    startedAt: s.startedAt,
    exportedAt: Date.now(),
    transcript: s.transcript,
    suggestionBatches: [...s.batches].reverse(), // oldest → newest for readability
    chat: s.chat,
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date(s.startedAt).toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `twinmind-session-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
