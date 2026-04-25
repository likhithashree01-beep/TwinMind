"use client";

import { useState } from "react";
import { useSession, useSettings } from "@/lib/store";
import { downloadSession } from "@/lib/export";
import { SettingsModal } from "./SettingsModal";

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const transcriptCount = useSession((s) => s.transcript.length);
  const batchCount = useSession((s) => s.batches.length);
  const chatCount = useSession((s) => s.chat.length);
  const hasApiKey = useSettings((s) => Boolean(s.settings.apiKey));
  const hasAnything = transcriptCount + batchCount + chatCount > 0;

  return (
    <>
      <header className="flex items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[15px] font-semibold tracking-tight text-[var(--text)]">
            TwinMind <span className="text-[var(--text-faint)]">— Live Suggestions</span>
          </h1>
          {!hasApiKey ? (
            <span className="rounded-md bg-[var(--warn)]/15 px-2 py-0.5 text-[11px] tracking-wide text-[var(--warn)]">
              Add Groq API key in Settings
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={downloadSession}
            disabled={!hasAnything}
            className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-[12px] text-[var(--text-dim)] transition hover:border-[var(--accent)]/40 hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40"
            title="Download full session as JSON"
          >
            Export session
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-[12px] text-[var(--text-dim)] transition hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
          >
            Settings
          </button>
        </div>
      </header>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
