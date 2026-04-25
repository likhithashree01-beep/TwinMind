"use client";

import { useEffect, useState } from "react";
import { useSession, useSettings } from "@/lib/store";
import { useSuggestionsRefresh } from "@/lib/hooks";
import { formatClockTime, formatRelative } from "@/lib/format";
import type { Suggestion } from "@/lib/types";
import { Panel } from "./Panel";
import { SuggestionCard } from "./SuggestionCard";

type Props = {
  onClickSuggestion: (s: Suggestion) => void;
};

export function SuggestionsPanel({ onClickSuggestion }: Props) {
  const batches = useSession((s) => s.batches);
  const suggesting = useSession((s) => s.suggesting);
  const recording = useSession((s) => s.recording);
  const lastSuggestionsAt = useSession((s) => s.lastSuggestionsAt);
  const refreshIntervalSec = useSettings((s) => s.settings.refreshIntervalSec);
  const refreshNow = useSuggestionsRefresh();

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const nextInSec = (() => {
    if (!recording || !lastSuggestionsAt) return null;
    const elapsed = Math.floor((now - lastSuggestionsAt) / 1000);
    return Math.max(0, refreshIntervalSec - elapsed);
  })();

  const headerLabel =
    batches.length === 0
      ? "0 batches"
      : `${batches.length} batch${batches.length > 1 ? "es" : ""}`;

  return (
    <Panel
      title="2. Live Suggestions"
      rightLabel={headerLabel}
      toolbar={
        <div className="flex items-center justify-between px-5 py-3">
          <button
            type="button"
            onClick={() => void refreshNow()}
            disabled={suggesting}
            className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-1.5 text-[12px] text-[var(--text-dim)] transition hover:border-[var(--accent)]/40 hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden>↻</span>
            {suggesting ? "Generating…" : "Reload suggestions"}
          </button>
          <span className="text-[11px] text-[var(--text-faint)]">
            {nextInSec !== null
              ? `auto-refresh in ${formatRelative(nextInSec)}`
              : recording
                ? "auto-refresh active"
                : "manual refresh only"}
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-4 py-3 text-[13px] leading-relaxed text-[var(--text-dim)]">
          Every reload (auto every ~{refreshIntervalSec}s, or manual) produces{" "}
          <span className="text-[var(--text)]">3 fresh suggestions</span> from
          recent transcript context. New batches appear at the top; older
          batches stay below (faded). Each card is a tappable preview — a{" "}
          <span className="text-[#93c5fd]">question to ask</span>, a{" "}
          <span className="text-[#c4b5fd]">talking point</span>, an{" "}
          <span className="text-[#86efac]">answer</span>, a{" "}
          <span className="text-[#fcd34d]">fact-check</span>, or{" "}
          <span className="text-[#fda4af]">clarification</span>.
        </div>

        {batches.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-[var(--text-faint)]">
            {suggesting
              ? "Generating first batch…"
              : "Suggestions appear here once recording starts."}
          </div>
        ) : null}

        {batches.map((batch, batchIdx) => (
          <div key={batch.id} className="flex flex-col gap-3">
            <div className="flex flex-col gap-3">
              {batch.items.map((it) => (
                <SuggestionCard
                  key={it.id}
                  suggestion={it}
                  onClick={onClickSuggestion}
                  faded={batchIdx > 0}
                />
              ))}
            </div>
            <div className="text-center text-[11px] tracking-[0.18em] text-[var(--text-faint)] uppercase">
              — Batch {batches.length - batchIdx} · {formatClockTime(batch.ts)} —
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
