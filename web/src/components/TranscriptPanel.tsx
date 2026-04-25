"use client";

import { useEffect, useRef } from "react";
import { useSession } from "@/lib/store";
import { useMic } from "@/lib/hooks";
import { formatClockTime } from "@/lib/format";
import { Panel } from "./Panel";

export function TranscriptPanel() {
  const transcript = useSession((s) => s.transcript);
  const recording = useSession((s) => s.recording);
  const transcribing = useSession((s) => s.transcribing);
  const { toggle } = useMic();
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollerRef.current?.closest(".panel-scroll");
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript.length, transcribing]);

  const status = recording
    ? transcribing
      ? "Recording… transcribing chunk"
      : "Recording. Transcript appends every ~30s."
    : transcript.length > 0
      ? "Stopped. Click to resume."
      : "Click mic to start. Transcript appends every ~30s.";

  const emptyMessage = recording
    ? "Listening… first transcript chunk arrives in ~30s."
    : "No transcript yet — click the mic to start.";

  return (
    <Panel
      title="1. Mic & Transcript"
      rightLabel={recording ? "REC" : "IDLE"}
      toolbar={
        <div className="flex flex-col gap-3 px-5 py-4">
          <button
            type="button"
            onClick={toggle}
            className="flex items-center gap-3 text-left transition hover:opacity-90"
          >
            <span
              className={`relative flex h-12 w-12 items-center justify-center rounded-full border ${
                recording
                  ? "border-red-500/40 bg-red-500/10"
                  : "border-[var(--accent)]/40 bg-[var(--accent)]/10"
              }`}
            >
              <span
                className={`block h-3 w-3 rounded-full ${
                  recording ? "bg-red-500 rec-dot" : "bg-[var(--accent)]"
                }`}
              />
            </span>
            <span className="text-[13px] text-[var(--text-dim)]">{status}</span>
          </button>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-4 py-3 text-[12px] leading-relaxed text-[var(--text-dim)]">
            Transcript appends a new chunk every ~30 seconds while recording.
            Auto-scrolls to the latest line. Use{" "}
            <span className="text-[var(--text)]">Export session</span> in the
            header to download the full session.
          </div>
        </div>
      }
    >
      {transcript.length === 0 ? (
        <div className="px-5 py-12 text-center text-[13px] text-[var(--text-faint)]">
          {emptyMessage}
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-5 py-5">
          {transcript.map((chunk) => (
            <p
              key={chunk.id}
              className="text-[14px] leading-relaxed text-[var(--text)]"
            >
              <span className="mr-2 font-mono text-[11px] text-[var(--text-faint)]">
                {formatClockTime(chunk.ts)}
              </span>
              {chunk.text}
            </p>
          ))}
          {transcribing ? (
            <p className="text-[12px] italic text-[var(--text-faint)]">
              transcribing latest chunk…
            </p>
          ) : null}
          <div ref={scrollerRef} />
        </div>
      )}
    </Panel>
  );
}
