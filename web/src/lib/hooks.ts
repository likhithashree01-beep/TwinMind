"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSession, useSettings } from "./store";
import { RotatingRecorder } from "./recorder";
import { fetchSuggestions, transcribeBlob } from "./api";
import { formatGroqError } from "./format";

// Module-level guard so multiple hook callers can't double-fire the
// suggestions API. The hook is consumed in two places (auto-refresh in the
// page, and the manual reload button in SuggestionsPanel) — without this
// shared flag, each call site would maintain its own ref and the timer would
// trigger two parallel batches every interval.
let suggestionsInflight = false;

// Minimum transcript content (in chars, after trim) before we'll fire a
// suggestions request. Below this threshold the model tends to produce
// rambling preambles that get truncated mid-JSON, and the suggestions
// wouldn't be useful anyway. ~30 chars is roughly one short sentence.
const MIN_TRANSCRIPT_CHARS_FOR_SUGGESTIONS = 30;

async function refreshSuggestionsOnce(
  opts: { silent?: boolean } = {},
): Promise<void> {
  if (suggestionsInflight) return;
  const { settings } = useSettings.getState();
  const session = useSession.getState();
  if (!settings.apiKey) {
    if (!opts.silent) {
      session.setError(
        "Add your Groq API key in Settings before refreshing suggestions.",
      );
    }
    return;
  }
  if (!session.recording && session.transcript.length === 0) return;

  const totalChars = session.transcript.reduce(
    (n, c) => n + c.text.length,
    0,
  );
  if (totalChars < MIN_TRANSCRIPT_CHARS_FOR_SUGGESTIONS) {
    if (!opts.silent) {
      session.setError(
        "Not enough transcript yet — keep recording for ~30 seconds before reloading suggestions.",
      );
    }
    return;
  }

  suggestionsInflight = true;
  session.setSuggesting(true);
  try {
    const recent = sliceRecentTranscript(
      session.transcript,
      settings.suggestionsContextChars,
    );
    const recentBatchesPreviews = session.batches
      .slice(0, 2)
      .flatMap((b) => b.items.map((it) => it.preview));
    const items = await fetchSuggestions(settings.apiKey, {
      recentTranscript: recent,
      recentBatchesPreviews,
      systemPrompt: settings.suggestionsPrompt,
    });
    // Empty result = silent skip (likely silence in the audio). Don't push a
    // batch and don't surface an error — just keep the existing batch list.
    useSession.getState().setLastSuggestionsAt(Date.now());
    useSession.getState().setError(null);
    if (items.length > 0) {
      useSession.getState().pushBatch(items);
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : "Suggestions failed";
    useSession.getState().setError(formatGroqError("Suggestions", raw));
  } finally {
    suggestionsInflight = false;
    useSession.getState().setSuggesting(false);
  }
}

export function useMic() {
  const recorderRef = useRef<RotatingRecorder | null>(null);
  const recording = useSession((s) => s.recording);
  const setRecording = useSession((s) => s.setRecording);
  const setTranscribing = useSession((s) => s.setTranscribing);
  const setError = useSession((s) => s.setError);
  const appendTranscript = useSession((s) => s.appendTranscript);

  const start = useCallback(async () => {
    const apiKey = useSettings.getState().settings.apiKey;
    if (!apiKey) {
      setError("Add your Groq API key in Settings before recording.");
      return;
    }
    if (recorderRef.current) return;
    const chunkMs = useSettings.getState().settings.refreshIntervalSec * 1000;
    const rec = new RotatingRecorder({
      chunkMs,
      onChunk: async (blob) => {
        setTranscribing(true);
        try {
          const text = await transcribeBlob(apiKey, blob);
          if (text) {
            appendTranscript(text);
            // Drive the suggestions cadence off transcript arrival so both
            // panels update in lockstep. Silent flag suppresses cold-start
            // errors during auto-refresh.
            void refreshSuggestionsOnce({ silent: true });
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Transcription failed");
        } finally {
          setTranscribing(false);
        }
      },
      onError: (err) => {
        setError(err.message);
        setRecording(false);
        recorderRef.current?.stop();
        recorderRef.current = null;
      },
    });
    const ok = await rec.start();
    if (ok) {
      recorderRef.current = rec;
      setRecording(true);
      setError(null);
    }
  }, [appendTranscript, setError, setRecording, setTranscribing]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, [setRecording]);

  const toggle = useCallback(() => {
    if (recording) stop();
    else void start();
  }, [recording, start, stop]);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
      recorderRef.current = null;
    };
  }, []);

  return { recording, start, stop, toggle };
}

/**
 * Returns a stable refresh function for the manual "Reload suggestions"
 * button. Auto-refresh is driven by transcript-chunk arrival inside useMic
 * (one cadence for both panels), so there's no separate timer hook.
 */
export function useSuggestionsRefresh() {
  return useCallback(() => refreshSuggestionsOnce(), []);
}

function sliceRecentTranscript(
  chunks: { text: string; ts: number }[],
  maxChars: number,
): string {
  if (chunks.length === 0) return "";
  const lines: string[] = [];
  let total = 0;
  for (let i = chunks.length - 1; i >= 0; i--) {
    const line = chunks[i].text;
    if (total + line.length + 1 > maxChars && lines.length > 0) break;
    lines.unshift(line);
    total += line.length + 1;
  }
  return lines.join(" ");
}

export function fullTranscriptText(
  chunks: { text: string; ts: number }[],
  maxChars: number,
): string {
  if (chunks.length === 0) return "";
  const all = chunks.map((c) => c.text).join(" ");
  if (all.length <= maxChars) return all;
  return all.slice(all.length - maxChars);
}
