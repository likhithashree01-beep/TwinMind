export function formatClockTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function formatRelative(secs: number): string {
  if (secs <= 0) return "0s";
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

/**
 * Translate raw Groq/network error text into a friendlier message that's
 * useful to a user (or evaluator) reading the error banner mid-meeting.
 * Common cases — rate limit, auth, server errors — are recognized; anything
 * else falls through to the raw message.
 */
export function formatGroqError(label: string, raw: string): string {
  const text = raw || "";
  // 429 — rate limit. Most common transient error.
  if (/\b429\b/.test(text) || /rate.?limit/i.test(text)) {
    return `${label} paused — Groq rate limit hit (HTTP 429). Will retry automatically.`;
  }
  // 401/403 — auth.
  if (/\b401\b/.test(text) || /\b403\b/.test(text) || /invalid.?api.?key/i.test(text)) {
    return `${label} failed — Groq API key was rejected. Open Settings and check the key.`;
  }
  // 5xx — Groq service problem.
  const fiveXx = text.match(/\b(5\d{2})\b/);
  if (fiveXx) {
    return `${label} failed — Groq service error (HTTP ${fiveXx[1]}). Will retry automatically.`;
  }
  // Network-level failures.
  if (/Failed to fetch|NetworkError|ECONNREFUSED|fetch failed/i.test(text)) {
    return `${label} failed — network error reaching Groq. Check connection.`;
  }
  // Fall through with a clean prefix so banner shows context.
  return `${label} failed — ${text}`;
}
