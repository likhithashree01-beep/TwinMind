export const GROQ_BASE = "https://api.groq.com/openai/v1";
export const TRANSCRIBE_MODEL = "whisper-large-v3";
export const CHAT_MODEL = "openai/gpt-oss-120b";

export function getGroqKey(req: Request): string | null {
  const key = req.headers.get("x-groq-key");
  if (!key || key.trim().length < 10) return null;
  return key.trim();
}

export class GroqError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function groqJSON<T>(
  apiKey: string,
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${GROQ_BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GroqError(res.status, text || res.statusText);
  }
  return (await res.json()) as T;
}
