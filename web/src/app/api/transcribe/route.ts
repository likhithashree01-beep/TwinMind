import { NextRequest, NextResponse } from "next/server";
import { GROQ_BASE, TRANSCRIBE_MODEL, getGroqKey } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const apiKey = getGroqKey(req);
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing or invalid Groq API key. Open Settings and paste your key." },
      { status: 401 },
    );
  }

  const inboundForm = await req.formData();
  const file = inboundForm.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  const outboundForm = new FormData();
  outboundForm.append("file", file, file.name || "chunk.webm");
  outboundForm.append("model", TRANSCRIBE_MODEL);
  outboundForm.append("response_format", "json");
  outboundForm.append("temperature", "0");
  // Bias Whisper towards plain transcription, not translation.
  outboundForm.append("language", "en");

  const res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: outboundForm,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Groq transcription failed: ${res.status} ${text || res.statusText}` },
      { status: res.status },
    );
  }

  const data = (await res.json()) as { text?: string };
  const cleaned = filterHallucinations((data.text ?? "").trim());
  return NextResponse.json({ text: cleaned });
}

// Whisper is famously prone to hallucinating boilerplate phrases when the
// audio is silent or near-silent — typically YouTube-style sign-offs because
// of its training data. Filter the most common ones out so they don't end up
// in the transcript and pollute the suggestions context.
const HALLUCINATION_EXACT = new Set(
  [
    "you",
    "you.",
    ".",
    "thank you.",
    "thank you",
    "thanks.",
    "thanks",
    "bye.",
    "bye",
    "[music]",
    "(music)",
    "[silence]",
    "(silence)",
    "♪",
    "♪♪",
  ].map((s) => s.toLowerCase()),
);

const HALLUCINATION_PATTERNS: RegExp[] = [
  /^thanks?\s+for\s+watching[.! ]*$/i,
  /^thank\s+you\s+for\s+watching[.! ]*$/i,
  /^subtitles?\s+by[\s\S]*$/i,
  /^see\s+you\s+next\s+time[.! ]*$/i,
  /^i'?ll\s+see\s+you\s+next\s+time[.! ]*$/i,
  /^please\s+subscribe[.! ]*$/i,
  /^(\.|\s)+$/, // pure punctuation/whitespace
];

function filterHallucinations(text: string): string {
  if (!text) return "";
  const norm = text.trim().toLowerCase();
  if (HALLUCINATION_EXACT.has(norm)) return "";
  for (const p of HALLUCINATION_PATTERNS) {
    if (p.test(text.trim())) return "";
  }
  return text;
}
