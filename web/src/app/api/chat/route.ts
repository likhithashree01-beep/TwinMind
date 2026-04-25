import { NextRequest } from "next/server";
import { CHAT_MODEL, GROQ_BASE, getGroqKey } from "@/lib/groq";
import {
  DEFAULT_CHAT_PROMPT,
  DEFAULT_DETAILED_ANSWER_PROMPT,
} from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatTurn = { role: "user" | "assistant"; content: string };

type Body = {
  mode: "detailed" | "chat";
  fullTranscript: string;
  history: ChatTurn[];
  userMessage: string;
  clickedSuggestion?: {
    type: string;
    preview: string;
    detail_seed: string;
  };
  systemPrompt?: string;
};

export async function POST(req: NextRequest) {
  const apiKey = getGroqKey(req);
  if (!apiKey) {
    return jsonError("Missing or invalid Groq API key. Open Settings and paste your key.", 401);
  }

  const body = (await req.json()) as Body;
  const system = (
    body.systemPrompt ||
    (body.mode === "detailed" ? DEFAULT_DETAILED_ANSWER_PROMPT : DEFAULT_CHAT_PROMPT)
  ).trim();

  const transcriptBlock = body.fullTranscript?.trim() || "(no transcript captured yet)";
  const cardBlock = body.clickedSuggestion
    ? `TAPPED SUGGESTION:
- type: ${body.clickedSuggestion.type}
- preview: ${body.clickedSuggestion.preview}
- detail_seed: ${body.clickedSuggestion.detail_seed}`
    : "";

  const sysWithContext = `${system}

SESSION TRANSCRIPT (most recent at the bottom):
"""
${transcriptBlock}
"""
${cardBlock ? `\n${cardBlock}` : ""}`;

  const messages = [
    { role: "system", content: sysWithContext },
    ...body.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: body.userMessage },
  ];

  const upstream = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: 0.4,
      max_tokens: 700,
      stream: true,
      messages,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return jsonError(`Groq error: ${upstream.status} ${text || upstream.statusText}`, upstream.status);
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      let buffer = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const delta: string | undefined =
                json.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              // ignore malformed lines
            }
          }
        }
      } catch (err) {
        controller.error(err);
        return;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
