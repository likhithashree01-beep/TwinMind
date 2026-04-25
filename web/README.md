# TwinMind — Live Suggestions Web App

An always-on meeting copilot. Mic on the left, live suggestions in the middle, in-meeting chat on the right. Audio is transcribed in 30-second chunks; every batch surfaces 3 useful, varied suggestions you can tap to expand into a detailed answer.

Built for the TwinMind Live Suggestions assignment. Models are fixed by the spec: **Groq Whisper Large V3** for transcription, **Groq `openai/gpt-oss-120b`** for suggestions and chat — so the only variable is prompt engineering.

---

## Quick start

```bash
cd web
npm install
npm run dev
# open http://localhost:3000
```

1. Open **Settings** (top-right).
2. Paste your **Groq API key** (`gsk_...`). Stored in `localStorage` only — never persisted server-side.
3. Click the **mic** to start. The first transcript chunk arrives ~30s later, with the first batch of suggestions soon after.
4. Tap a suggestion card to stream a detailed answer in the chat panel, or type a question directly.
5. **Export session** in the header downloads the full transcript + every suggestion batch + chat as a JSON file.

No login. No persistence. Reload = fresh session.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | One-click Vercel deploy, server-side prompt handling via Route Handlers |
| Styling | Tailwind v4 | Matches the dark mockup quickly |
| State | Zustand (+ persist for Settings) | Tiny, no boilerplate; perfect for one-session scope |
| Audio | `MediaRecorder` API with rotating restart every 30s | Each chunk is a complete container Whisper can decode (a fixed-timeslice approach yields partial WebM segments Whisper rejects) |
| LLM transport | Browser → `/api/*` → Groq | Keeps prompts server-side, key sent per-request as `X-Groq-Key` header — never stored on the server |
| Streaming | SSE-style chunks via `fetch` + `ReadableStream` | Native, no extra deps, first-token visible as soon as Groq emits |
| Validation | Zod on every suggestion batch | Catches malformed JSON before it reaches the UI |

---

## Architecture

```
Browser
├─ MicCapture (RotatingRecorder)
│    └─ every 30s → POST /api/transcribe → Groq Whisper Large V3 → text
│         └─ append to transcript store
├─ Suggestions loop (every 30s + manual reload button)
│    └─ POST /api/suggestions { recentTranscript, recentBatchesPreviews }
│         └─ Groq gpt-oss-120b (JSON mode) → 3 typed cards → push to top of batch list
├─ Click a card / type a question
│    └─ POST /api/chat (streamed)
│         └─ Groq gpt-oss-120b (stream:true) with FULL transcript context
└─ Export → client-side JSON download
```

The user's Groq key lives only in browser `localStorage`. Each request to our backend includes it as `X-Groq-Key`. The backend forwards it to Groq and forgets it. Nothing is persisted server-side.

---

## Prompt strategy (the part being graded)

Three system prompts, all editable in Settings. The defaults are tuned to the assignment's "right thing at the right time" framing.

### 1. Live suggestions (`DEFAULT_SUGGESTIONS_PROMPT`)

**Goal:** every 30s, return exactly 3 *varied* suggestions whose **previews already deliver value without clicking**.

Five suggestion types: `question_to_ask`, `talking_point`, `answer`, `fact_check`, `clarification`. The prompt explicitly:

- **Forces diversity.** Three of the same type are forbidden unless the situation truly calls for it — most batches are a mix.
- **Recency-weights** the last ~60s of transcript more than older content.
- **Suppresses repetition.** The previous 2 batches' previews are passed as "already shown" context so the model moves the conversation forward instead of looping.
- **Demands concreteness.** No "ask for more detail" / "consider clarifying X" filler — only specific questions, specific facts, specific corrections.
- **Gates rare types.** `fact_check` requires a real, falsifiable claim that was actually said; `answer` requires a real recent question. If neither applies, the model picks a different type.
- **Adapts to meeting type** (interview vs. sales call vs. casual chat) by inferring register from transcript signals.
- **Handles cold start.** If the transcript is < ~15 words, the model produces three concrete openers tied to whatever topic is forming, not "What brings you here today?"-style filler.

**Output is strict JSON** validated by Zod (`suggestionsResponseSchema`). Malformed responses surface as a 502 with the raw model output so the user can iterate the prompt without guessing.

### 2. Detailed answer on click (`DEFAULT_DETAILED_ANSWER_PROMPT`)

A separate, longer-form prompt. It receives:

- The full session transcript (truncated to `chatContextChars`, default 8,000 chars)
- The tapped card (type + preview + `detail_seed`)
- The previous chat turns

It must produce a tight (~≤ 220 words), markdown-friendly expansion that **leads with the answer**, grounds in the transcript when relevant, and skips preamble. Behavior branches by suggestion type — `talking_point` becomes 2–3 things the user could say; `question_to_ask` becomes "why this is a sharp question + what a strong answer looks like"; etc.

### 3. Free-form chat (`DEFAULT_CHAT_PROMPT`)

Used when the user types directly. Same context and length budget as the detailed-answer prompt, but framed as peer-style answering with the same anti-sycophancy rules. The same backend handler serves both (`mode: "detailed" | "chat"`).

### Context decisions

| Setting | Default | Reasoning |
|---|---|---|
| `suggestionsContextChars` | 2,500 | ~60–90s of speech. Big enough to span a topic, small enough to keep `gpt-oss-120b` latency under ~1s on Groq |
| `chatContextChars` | 8,000 | Full session for typical 5–15 minute meetings; truncated tail-first if longer |
| `refreshIntervalSec` | 30 | Matches the spec; also matches MediaRecorder rotation |
| Suggestions temperature | 0.5 | Variety without drift; deterministic-ish JSON shape |
| Chat temperature | 0.4 | Slightly tighter for answer quality |
| `recentBatchesPreviews` passed | Last 2 batches | Enough to suppress repeats without bloating context |

All numbers are editable in Settings — the assignment requires this — and reset to these defaults from a single button.

---

## File structure

```
web/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx               # 3-column shell, wires panels
│  │  ├─ layout.tsx             # dark theme root
│  │  ├─ globals.css
│  │  └─ api/
│  │     ├─ transcribe/route.ts # forwards audio blob to Groq Whisper
│  │     ├─ suggestions/route.ts# JSON-mode call, returns 3 typed cards
│  │     └─ chat/route.ts       # streaming SSE → ReadableStream
│  ├─ components/
│  │  ├─ Header.tsx             # title, export, settings button, key warning
│  │  ├─ Panel.tsx              # shared panel chrome (title bar, scroll body)
│  │  ├─ TranscriptPanel.tsx
│  │  ├─ SuggestionsPanel.tsx
│  │  ├─ SuggestionCard.tsx     # color-coded by type
│  │  ├─ ChatPanel.tsx          # streaming UI + free-form input
│  │  ├─ SettingsModal.tsx      # editable prompts + context windows + key
│  │  └─ ErrorBanner.tsx
│  └─ lib/
│     ├─ types.ts
│     ├─ prompts.ts             # default system prompts (the brain)
│     ├─ schemas.ts             # Zod schemas for suggestion JSON
│     ├─ store.ts               # Zustand: session + settings (persisted)
│     ├─ groq.ts                # tiny server-side Groq client + key reader
│     ├─ recorder.ts            # RotatingRecorder (30s WebM rotation)
│     ├─ hooks.ts               # useMic, useSuggestionsLoop, transcript helpers
│     ├─ api.ts                 # browser-side wrappers for /api/*
│     ├─ format.ts
│     └─ export.ts              # client-side JSON download
└─ README.md (you are here)
```

---

## Settings reference

Everything in the Settings modal lives in `localStorage` under `twinmind-settings`:

- **Groq API key** — `gsk_...` from console.groq.com. Required.
- **Auto-refresh (sec)** — also drives MediaRecorder chunk size.
- **Suggestions / Chat context (chars)** — transcript budget per call.
- **Live suggestions prompt** — system prompt for the 3-card generator.
- **Detailed answer prompt** — system prompt when a card is tapped.
- **Chat prompt** — system prompt for free-form questions.

Each prompt has a "Reset to default" button. There is also a "Reset all prompts to defaults" link at the bottom of the modal.

---

## Deploy

### Vercel (recommended)

1. Push this repo to GitHub.
2. On vercel.com → New Project → import the repo. Set the **Root Directory** to `web/`.
3. Defaults are correct (Next.js, build = `next build`, output = standard).
4. Deploy. **No environment variables required** — the user pastes their own Groq key in the deployed app.
5. Open the public URL, paste the key, you're done.

### Other targets

Nothing in the app requires Vercel-specific features. Any Node host that supports Next.js 16 (App Router, streaming responses) will work — Netlify, Render, Fly, a self-hosted Node server, etc.

---

## Latency notes

- **Reload click → first card rendered:** typically ~600–1100 ms (one `gpt-oss-120b` JSON call on Groq, ~1k input tokens, ~250 output tokens).
- **Chat send → first token:** typically ~250–600 ms with streaming. Subsequent tokens arrive at ~500+ tok/s.
- **Whisper chunk → transcript appended:** typically ~1–2 s for a 30s WebM blob.

These are dominated by Groq's inference time, not network or app code. Streaming the chat response (rather than buffering) is the single biggest first-token win.

---

## Tradeoffs and what I'd do with more time

- **Voice-activity-aware chunking.** Right now we cut every 30s regardless of whether the speaker is mid-sentence. A VAD-aware chunker would trim silences and split on natural pauses, improving Whisper accuracy and giving the suggestions prompt cleaner sentences. Not worth the complexity for a 10-day take-home.
- **Speaker diarization.** Whisper alone returns a single text stream. For multi-party meetings, Groq's transcribe doesn't yet support diarization in this model — adding it would mean a separate diarizer pipeline.
- **Adaptive context windows.** Right now `suggestionsContextChars` is fixed. A smarter version would expand the window early in the meeting (when there's not much to look at) and contract it once the conversation has clear topic structure.
- **Tool-use / structured outputs.** I went with JSON mode + Zod validation for portability. If we committed to Groq's tool-call schema, we'd get stricter typing and slightly tighter outputs at the cost of some prompt readability.
- **Richer "already-shown" state.** Right now we pass the previous 2 batches' previews as plain text. A semantic dedupe (small embedding model) would catch near-duplicates the model paraphrases.
- **Markdown rendering in chat.** Currently the streamed answer is rendered as `whitespace-pre-wrap`. A real markdown pipeline (with sanitization) is a 30-minute add but beyond scope.

---

## Defending the prompt-engineering choices

- **Why 5 suggestion types, not fewer?** Three types (`question`, `point`, `fact`) covers most cases but loses sharpness. `answer` and `clarification` are distinct enough in shape that collapsing them into the others made previews vaguer. Five gives the model a clear menu and the user a clear color-code.
- **Why pass previous batches as previews, not full cards?** Smaller context, and the preview is what the user already saw — it's the thing we need to not repeat. The `detail_seed` is internal and fine to vary across batches.
- **Why `temperature: 0.5` for suggestions?** At 0 the model returns very similar batches across reloads. At 0.7 the JSON shape sometimes drifts. 0.5 gave the best variety/format reliability ratio in my testing.
- **Why same `gpt-oss-120b` for both panels?** The assignment fixes the model. Even without that constraint, on Groq the latency is fast enough (~500+ tok/s) that there's no quality argument for splitting models.
- **Why client-side `localStorage` for the key, not session-only memory?** UX. The user pastes once and reloads still work. The security tradeoff is small — same-origin script can read it, but the user's own browser is also where their key would live in any other API playground. The key is never sent to a backend we control beyond the immediate proxy hop.

---

## License

Built for the TwinMind take-home. No license; treat as a private submission.
