import { NextRequest, NextResponse } from "next/server";
import { CHAT_MODEL, GroqError, getGroqKey, groqJSON } from "@/lib/groq";
import {
  suggestionItemSchema,
  type SuggestionItem,
  suggestionTypeSchema,
} from "@/lib/schemas";
import { DEFAULT_SUGGESTIONS_PROMPT } from "@/lib/prompts";
import type { SuggestionType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  recentTranscript: string;
  recentBatchesPreviews?: string[];
  systemPrompt?: string;
};

type ChatCompletion = {
  choices: { message: { content: string } }[];
};

export async function POST(req: NextRequest) {
  const apiKey = getGroqKey(req);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing or invalid Groq API key. Open Settings and paste your key." },
      { status: 401 },
    );
  }

  const body = (await req.json()) as Body;
  const recent = (body.recentTranscript || "").trim();
  const previousPreviews = body.recentBatchesPreviews ?? [];
  const systemPrompt = (body.systemPrompt || DEFAULT_SUGGESTIONS_PROMPT).trim();

  const userMessage = buildUserMessage(recent, previousPreviews);
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userMessage },
  ];

  try {
    let raw: string;
    try {
      // First attempt: strict JSON mode (cheaper, more reliable when it works).
      const completion = await groqJSON<ChatCompletion>(apiKey, "/chat/completions", {
        model: CHAT_MODEL,
        temperature: 0.5,
        max_tokens: 900,
        response_format: { type: "json_object" },
        messages,
      });
      raw = completion.choices?.[0]?.message?.content ?? "";
    } catch (err) {
      // Groq rejects with `json_validate_failed` if the model produces output
      // that doesn't parse as JSON. Fall back to a free-form generation and
      // let our tolerant parser extract the JSON from whatever comes back.
      if (isJsonValidateFailed(err)) {
        const completion = await groqJSON<ChatCompletion>(apiKey, "/chat/completions", {
          model: CHAT_MODEL,
          temperature: 0.5,
          max_tokens: 900,
          messages,
        });
        raw = completion.choices?.[0]?.message?.content ?? "";
      } else {
        throw err;
      }
    }

    const items = safeExtractItems(raw);
    const deduped = dedupeByPreview(items ?? []);
    if (deduped.length === 0) {
      // Either silence (empty output) or the model emitted partial/malformed
      // JSON we couldn't recover. Either way, this is not user-actionable in
      // the middle of a meeting — return 200 with empty items so the client
      // silently skips this tick. Log the raw output to the server console
      // for debugging.
      const reason = raw.trim() ? "parse_error" : "empty_output";
      if (reason === "parse_error") {
        console.error("[suggestions] could not extract items from model output:", {
          raw: truncate(raw, 1000),
        });
      }
      return NextResponse.json({
        items: [],
        skipped: reason,
        ...(reason === "parse_error" ? { debug: truncate(raw, 600) } : {}),
      });
    }
    return NextResponse.json({ items: deduped.slice(0, 3) });
  } catch (err) {
    const status = err instanceof GroqError ? err.status : 500;
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: `Groq error: ${message}` }, { status });
  }
}

function isJsonValidateFailed(err: unknown): boolean {
  if (!(err instanceof GroqError)) return false;
  if (err.status !== 400) return false;
  return err.message.includes("json_validate_failed");
}

function buildUserMessage(recent: string, previousPreviews: string[]): string {
  const transcriptBlock = recent.length
    ? recent
    : "(no transcript yet — the meeting is just starting)";
  const priorBlock = previousPreviews.length
    ? previousPreviews.map((p, i) => `${i + 1}. ${p}`).join("\n")
    : "(none yet — this is the first batch)";

  return `RECENT TRANSCRIPT WINDOW:
"""
${transcriptBlock}
"""

ALREADY-SHOWN SUGGESTION PREVIEWS (do not repeat these or near-duplicates):
${priorBlock}

Produce 3 fresh, useful suggestions for this moment. The 3 items MUST use AT LEAST 2 distinct types (e.g. one question_to_ask + one talking_point + one fact_check). Three of the same type is forbidden.

Respond with ONLY a JSON object of this exact shape:
{"items":[{"type":"question_to_ask|talking_point|answer|fact_check|clarification","preview":"...","detail_seed":"..."},{...},{...}]}
The "items" array MUST contain exactly 3 entries.`;
}

const TYPE_ALIASES: Record<string, SuggestionType> = {
  // canonical
  question_to_ask: "question_to_ask",
  talking_point: "talking_point",
  answer: "answer",
  fact_check: "fact_check",
  clarification: "clarification",
  // common drift the model produces
  question: "question_to_ask",
  "question-to-ask": "question_to_ask",
  ask: "question_to_ask",
  "talking-point": "talking_point",
  point: "talking_point",
  insight: "talking_point",
  "fact-check": "fact_check",
  factcheck: "fact_check",
  correction: "fact_check",
  clarify: "clarification",
  define: "clarification",
  definition: "clarification",
  reply: "answer",
  response: "answer",
};

function safeExtractItems(raw: string): SuggestionItem[] | null {
  const text = (raw || "").trim();
  if (!text) return null;

  const candidates: unknown[] = [];

  // 1. Try the whole string as JSON.
  pushIfParsable(candidates, text);

  // 2. Try the first {...} block.
  const blockMatch = text.match(/\{[\s\S]*\}/);
  if (blockMatch) pushIfParsable(candidates, blockMatch[0]);

  // 3. Try the first [...] block (in case the model returned a bare array).
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) pushIfParsable(candidates, arrMatch[0]);

  for (const candidate of candidates) {
    const items = pluckItems(candidate);
    if (items && items.length > 0) return items;
  }

  // 4. Salvage. Walk the raw text and extract every balanced {...} object we
  // can parse. Recovers complete suggestion items when the outer envelope
  // was truncated mid-generation (cold-start verbose preambles, max_tokens
  // cutoffs, etc.).
  const salvaged = extractBalancedObjects(text);
  if (salvaged.length > 0) {
    const fromSalvage = pluckItems(salvaged);
    if (fromSalvage && fromSalvage.length > 0) return fromSalvage;
  }

  return null;
}

function pushIfParsable(out: unknown[], s: string) {
  try {
    out.push(JSON.parse(s));
  } catch {
    /* ignore */
  }
}

function extractBalancedObjects(text: string): unknown[] {
  // Stack-based walk that captures every balanced { ... } substring at any
  // depth. Critical for truncation cases where the outer envelope never
  // closes — we still recover any inner objects whose braces matched.
  const out: unknown[] = [];
  const starts: number[] = [];
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") {
      starts.push(i);
    } else if (ch === "}") {
      const start = starts.pop();
      if (start === undefined) continue;
      const candidate = text.slice(start, i + 1);
      try {
        out.push(JSON.parse(candidate));
      } catch {
        /* skip unparseable balanced block */
      }
    }
  }
  return out;
}

function pluckItems(value: unknown): SuggestionItem[] | null {
  let arr: unknown[] | null = null;
  if (Array.isArray(value)) {
    arr = value;
  } else if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of [
      "items",
      "suggestions",
      "cards",
      "results",
      "data",
      "output",
    ]) {
      if (Array.isArray(obj[key])) {
        arr = obj[key] as unknown[];
        break;
      }
    }
  }
  if (!arr) return null;

  const out: SuggestionItem[] = [];
  for (const entry of arr) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const rawType = String(e.type ?? e.kind ?? e.category ?? "")
      .toLowerCase()
      .trim();
    // Unknown types fall back to talking_point rather than getting dropped —
    // dropping items causes the batch to ship with fewer than 3 cards.
    const normType: SuggestionType =
      TYPE_ALIASES[rawType] ??
      (suggestionTypeSchema.safeParse(rawType).success
        ? (rawType as SuggestionType)
        : "talking_point");
    const preview = String(e.preview ?? e.text ?? e.title ?? e.summary ?? "")
      .trim();
    const detailSeed = String(
      e.detail_seed ??
        e.detailSeed ??
        e.detail ??
        e.body ??
        e.expansion ??
        preview,
    ).trim();
    if (!preview) continue;
    const candidate = {
      type: normType,
      preview: clip(preview, 400),
      detail_seed: clip(detailSeed || preview, 400),
    };
    const parsed = suggestionItemSchema.safeParse(candidate);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

function dedupeByPreview(items: SuggestionItem[]): SuggestionItem[] {
  const seen = new Set<string>();
  const out: SuggestionItem[] = [];
  for (const it of items) {
    const key = it.preview.toLowerCase().replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

function truncate(s: string, n: number): string {
  if (!s) return "(empty)";
  return s.length <= n ? s : s.slice(0, n) + "…";
}
