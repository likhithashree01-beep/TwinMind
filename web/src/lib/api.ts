"use client";

import { fileExtForMime } from "./recorder";
import type { Suggestion, ChatMessage } from "./types";
import { suggestionsResponseSchema } from "./schemas";

function authHeaders(apiKey: string): Record<string, string> {
  return { "x-groq-key": apiKey };
}

export async function transcribeBlob(
  apiKey: string,
  blob: Blob,
): Promise<string> {
  const ext = fileExtForMime(blob.type);
  const file = new File([blob], `chunk-${Date.now()}.${ext}`, { type: blob.type });
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: authHeaders(apiKey),
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `transcribe ${res.status}`);
  return data.text || "";
}

export async function fetchSuggestions(
  apiKey: string,
  args: {
    recentTranscript: string;
    recentBatchesPreviews: string[];
    systemPrompt: string;
  },
): Promise<Suggestion[]> {
  const res = await fetch("/api/suggestions", {
    method: "POST",
    headers: { ...authHeaders(apiKey), "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `suggestions ${res.status}`);
  // Server may return { items: [], skipped: "..." } for silent skips
  // (empty model output, parse failure on partial JSON, etc.). These are
  // not user-actionable mid-meeting — log them to the browser console for
  // debugging and return empty so the caller skips this tick.
  if (Array.isArray(data?.items) && data.items.length === 0) {
    if (data?.skipped) {
      // eslint-disable-next-line no-console
      console.warn(
        `[suggestions] skipped: ${data.skipped}`,
        data.debug ? { raw: data.debug } : {},
      );
    }
    return [];
  }
  const parsed = suggestionsResponseSchema.parse(data);
  return parsed.items.map((it) => ({
    id: "",
    type: it.type,
    preview: it.preview,
    detail_seed: it.detail_seed,
  }));
}

export async function streamChat(
  apiKey: string,
  args: {
    mode: "detailed" | "chat";
    fullTranscript: string;
    history: { role: "user" | "assistant"; content: string }[];
    userMessage: string;
    clickedSuggestion?: ChatMessage["sourceSuggestion"];
    systemPrompt: string;
  },
  onDelta: (delta: string) => void,
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { ...authHeaders(apiKey), "content-type": "application/json" },
    body: JSON.stringify({
      mode: args.mode,
      fullTranscript: args.fullTranscript,
      history: args.history,
      userMessage: args.userMessage,
      clickedSuggestion: args.clickedSuggestion
        ? {
            type: args.clickedSuggestion.type,
            preview: args.clickedSuggestion.preview,
            detail_seed: args.clickedSuggestion.detail_seed,
          }
        : undefined,
      systemPrompt: args.systemPrompt,
    }),
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `chat ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) onDelta(decoder.decode(value, { stream: true }));
  }
}
