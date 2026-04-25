# TwinMind — Live Suggestions

An always-on AI meeting copilot. Listens to live mic audio, transcribes in 30-second chunks, surfaces 3 useful suggestions every cycle, and lets you tap any card for a streamed detailed answer — or type your own question.

Built for the TwinMind take-home. Models are fixed by the spec: **Groq Whisper Large V3** for transcription, **Groq `openai/gpt-oss-120b`** for suggestions and chat — so the only variable being graded is prompt engineering.

> **Live demo:** _<paste Vercel URL here once deployed>_

---

## Quick start

```bash
cd web
npm install
npm run dev
# open http://localhost:3000
```

1. Click **Settings** (top-right). Paste your Groq API key (`gsk_...`). Save. Stored only in your browser's `localStorage` — never persisted server-side.
2. Click the **mic** button (left column).
3. After ~30 seconds, the first transcript chunk appears and the first batch of 3 suggestions lands in the middle column.
4. Tap any card to stream a detailed answer in the chat (right column). Or type a question directly in the input.
5. Click **Export session** in the header to download the full transcript + suggestion batches + chat history as JSON.

No login. No persistence. Reload the page = fresh session.

---

## Three panels, two prompts

```
┌─────────────────────┬─────────────────────┬─────────────────────┐
│ 1. MIC & TRANSCRIPT │ 2. LIVE SUGGESTIONS │ 3. CHAT (DETAILED)  │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ Start/stop mic      │ 3 typed cards/batch │ Click card → expand │
│ 30s rotating chunks │ Auto every ~30s     │ Or type question    │
│ Auto-scroll         │ + manual reload     │ Streaming markdown  │
│ Whisper Large V3    │ JSON-mode + Zod     │ Full transcript ctx │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

**Suggestion types** (5, color-coded):
- 🔵 `question_to_ask` — a sharp follow-up the user could ask next
- 🟣 `talking_point` — concrete fact / framing the user can drop into the conversation
- 🟢 `answer` — a direct reply when a question was just asked of the user
- 🟡 `fact_check` — a correction or context for a specific claim
- 🟠 `clarification` — a quick definition for jargon that just appeared

The prompt enforces *at least 2 distinct types per batch* and forbids paraphrase-of-paraphrase outputs — diversity is a hard rule, not optional.

---

## Architecture

```
Browser (React)
├─ MicCapture (RotatingRecorder)
│    └─ every 30s → POST /api/transcribe → Groq Whisper Large V3 → text
│         └─ append to transcript store
│              └─ side-effect: trigger suggestions refresh ───────┐
├─ Suggestions loop (chunk-driven + manual reload button)         │
│    └─ POST /api/suggestions { recentTranscript, recentBatches } ◄┘
│         └─ Groq gpt-oss-120b (JSON mode) → 3 typed cards
│              └─ push to top of batch list
├─ Click card / type question
│    └─ POST /api/chat (streamed)
│         └─ Groq gpt-oss-120b with FULL transcript context
└─ Export → client-side JSON download
```

The user's Groq key flows: `localStorage` → request header (`X-Groq-Key`) → Groq. Never persisted server-side. Each request to our backend includes it; the backend forwards to Groq and forgets it.

---

## Prompt strategy (the part being graded hardest)

Three system prompts, all editable in Settings. Defaults are tuned to the spec's "right thing at the right time" framing.

### 1. Live suggestions prompt

**Goal:** every 30s, return exactly 3 *varied* suggestions whose previews already deliver value without clicking.

Key rules baked into the default prompt:

- **Type diversity is mandatory** — at least 2 distinct types per batch. Three of the same type is explicitly framed as a failure mode the model has to reject. Concrete GOOD vs BAD batch shapes are listed inline.
- **Distinct previews** — the 3 previews must be substantively different content, not paraphrases.
- **Recency bias** — the last ~60s of transcript matter more than older content.
- **No repetition** — last 2 batches' previews are passed as "already shown" so the model moves the conversation forward.
- **Concrete only** — numbers, names, comparables. No "ask for more detail" filler.
- **Gates rare types** — `fact_check` requires a real, falsifiable claim that was actually said; `answer` requires a real recent question. If neither applies, pick a different type.
- **Adapts to meeting type** — interview / sales call / standup / casual — by inferring register from transcript signals.
- **Cold-start handling** — if transcript is < ~15 words, produce concrete openers tied to whatever topic is forming, not "What brings you here today?" filler.

**Output is strict JSON** validated by Zod (`suggestionsResponseSchema`). Multiple fallback layers handle Groq's `json_validate_failed`, partial truncation, type-name drift, and paraphrase duplicates.

### 2. Detailed answer prompt (on suggestion click)

A separate, longer-form prompt. Receives:
- The full session transcript (truncated to `chatContextChars`, default 8,000 chars)
- The tapped card (type + preview + `detail_seed`)
- The previous chat turns

Produces a tight (~≤ 220 words), markdown-friendly expansion that **leads with the answer**, grounds in the transcript when relevant, and skips preamble. Behavior branches by suggestion type — `talking_point` becomes 2–3 things the user could say; `question_to_ask` becomes "why this is a sharp question + what a strong answer looks like"; etc.

### 3. Free-form chat prompt (typed questions)

Used when the user types directly. Same context budget as the detailed-answer prompt, framed as peer-style answering with anti-sycophancy rules ("be a peer, not a butler"). Same backend handler serves both detailed-answer and free-form (`mode: "detailed" | "chat"`).

### Default context windows

| Setting | Default | Reasoning |
|---|---|---|
| `suggestionsContextChars` | 2,500 | ~60–90s of speech. Big enough to span a topic, small enough to keep `gpt-oss-120b` latency under ~1s on Groq |
| `chatContextChars` | 8,000 | Full session for typical 5–15 min meetings; truncated tail-first if longer |
| `refreshIntervalSec` | 30 | Matches the spec; also matches MediaRecorder rotation |
| Suggestions temperature | 0.5 | Variety without drift; reliable JSON shape |
| Chat temperature | 0.4 | Slightly tighter for answer quality |
| `recentBatchesPreviews` passed | Last 2 batches | Suppresses repeats without bloating context |

All editable in Settings (the spec requires this), all reset to these defaults from a single button.

---

## Technical highlights

- **Single 30s cadence for both panels** — suggestions fire as a side-effect of every successful transcription. Transcript and suggestions update in lockstep, never drift. No standalone timer.
- **Browser → `/api/*` → Groq** — keeps prompts server-side, easier to read in code review. Validates JSON shape with Zod. Key sent only in request headers.
- **MediaRecorder rotates every 30s** instead of using `timeslice` — guarantees each chunk is a complete WebM container Whisper can decode (timeslice gives partial segments Whisper rejects).
- **Tolerant parser, four-layer fallback** —
  1. Try whole string as JSON
  2. First `{...}` block via regex
  3. First `[...]` block (bare array)
  4. Stack-based balanced-`{...}` salvage to recover items even from partial truncated responses
- **Type-name drift handled** — `"question"` → `question_to_ask`, `"fact-check"` → `fact_check`, `"correction"` → `fact_check`, etc. Unknown types fall back to `talking_point` instead of being dropped (which would cause padding-with-duplicates).
- **Whisper hallucination filter** — strips Whisper's well-known silence-induced "Thanks for watching!" / "[Music]" / "Subtitles by…" outputs before they pollute the transcript and the suggestions context.
- **JSON-validate-failed retry** — if Groq's `response_format: json_object` rejects the model output, the route automatically retries without `response_format` and lets the tolerant parser extract from prose.
- **Tiered error UX** — actionable errors (rate limit, bad key, network) surface in a banner with friendly messages via `formatGroqError`. Transient parse errors stay in the server console only — no scary banners during a meeting.
- **Cold-start guard** — manual reload is no-op'd with friendly guidance ("keep recording for ~30 seconds…") below 30 transcript chars; auto-refresh stays silent in the same case.
- **Streaming chat with markdown** — `fetch` + `ReadableStream` for SSE-style streaming. `react-markdown` + `remark-gfm` with custom Tailwind component overrides for headings, lists, code, blockquotes, tables.
- **Session export** — single JSON download with start time, full transcript chunks (timestamped), every suggestion batch (timestamped), full chat history.

---

## Settings reference

Everything in the Settings modal lives in `localStorage` under `twinmind-settings`:

- **Groq API key** — `gsk_...` from console.groq.com. Required.
- **Auto-refresh interval (sec)** — also drives MediaRecorder chunk size.
- **Suggestions / Chat context (chars)** — transcript budget per call.
- **Live suggestions prompt** — system prompt for the 3-card generator.
- **Detailed answer prompt** — system prompt when a card is tapped.
- **Chat prompt** — system prompt for free-form questions.

Each prompt has a "Reset to default" button. There's also a global "Reset all prompts to defaults" link at the bottom of the modal.

---

## File structure

```
twinMind/
├─ web/                                # Next.js 16 app — set as Vercel Root Directory
│  ├─ src/
│  │  ├─ app/
│  │  │  ├─ page.tsx                   # 3-column shell, wires panels
│  │  │  ├─ layout.tsx                 # dark theme root
│  │  │  ├─ globals.css
│  │  │  └─ api/
│  │  │     ├─ transcribe/route.ts     # forwards audio blob to Groq Whisper
│  │  │     ├─ suggestions/route.ts    # JSON mode + tolerant parser + salvage
│  │  │     └─ chat/route.ts           # streaming SSE → ReadableStream
│  │  ├─ components/
│  │  │  ├─ Header.tsx                 # title, export, settings button, key warning
│  │  │  ├─ Panel.tsx                  # shared chrome (header, scroll body, footer)
│  │  │  ├─ TranscriptPanel.tsx        # mic pinned at top, transcript scrolls
│  │  │  ├─ SuggestionsPanel.tsx
│  │  │  ├─ SuggestionCard.tsx         # color-coded by type
│  │  │  ├─ ChatPanel.tsx              # streaming UI + free-form input
│  │  │  ├─ Markdown.tsx               # react-markdown + tailwind components
│  │  │  ├─ SettingsModal.tsx          # editable prompts + context windows + key
│  │  │  └─ ErrorBanner.tsx
│  │  └─ lib/
│  │     ├─ types.ts
│  │     ├─ prompts.ts                 # default system prompts (the brain)
│  │     ├─ schemas.ts                 # Zod schemas for suggestion JSON
│  │     ├─ store.ts                   # Zustand: session + settings (persisted)
│  │     ├─ groq.ts                    # tiny server-side Groq client + key reader
│  │     ├─ recorder.ts                # RotatingRecorder (30s WebM rotation)
│  │     ├─ hooks.ts                   # useMic, refreshSuggestionsOnce, helpers
│  │     ├─ api.ts                     # browser-side wrappers for /api/*
│  │     ├─ format.ts                  # time formatting + formatGroqError
│  │     └─ export.ts                  # client-side JSON session download
│  └─ package.json
├─ TwinMind - Live Suggestions Assignment April 2026.pdf
└─ README.md                           # ← you are here
```

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | One-click Vercel deploy, server-side prompt handling via Route Handlers |
| Styling | Tailwind v4 | Matches the dark mockup quickly, no design system overhead |
| State | Zustand (+ `persist` middleware) | Tiny, no boilerplate, perfect for one-session scope; settings auto-sync to `localStorage` |
| Audio | `MediaRecorder` API with rotating restart | Each blob is a complete WebM Whisper can decode |
| LLM transport | Browser → `/api/*` → Groq | Keeps prompts server-side, key sent per-request as header |
| Streaming | `fetch` + `ReadableStream` | Native, no extra deps, first-token visible as soon as Groq emits |
| Validation | Zod | Validates suggestion JSON shape; tolerant fallback parsing on top |
| Markdown | `react-markdown` + `remark-gfm` | Renders assistant responses with proper formatting, GFM tables/strikethrough |
| Deploy | Vercel | Free, instant, zero config for Next.js |

---

## Latency notes

- **Transcript chunk → first suggestion card rendered:** typically ~1.5–3s end-to-end (Whisper transcription + JSON-mode `gpt-oss-120b` call on Groq).
- **Suggestion card click → first answer token:** typically ~250–600 ms with streaming. Subsequent tokens at ~500+ tok/s on Groq.
- **Chat send → first token:** same range as above.
- **Whisper chunk → transcript appended:** typically ~1–2s for a 30s WebM blob.

Dominated by Groq inference time, not network or app code. Streaming chat (rather than buffering) is the single biggest first-token win.

---

## Deploy

This repo is set up for Vercel:

1. Import on Vercel → set **Root Directory** to `web/` (the Next.js app lives in the subfolder).
2. **Framework Preset** = Next.js (Vercel may auto-detect; if not, set explicitly in Settings → Build and Deployment).
3. **No environment variables required** — the user pastes their own Groq key into the in-app Settings modal.
4. Deploy. The public URL works end-to-end as soon as a key is added.

Any Node host that supports Next.js 16 streaming responses will also work — there's nothing Vercel-specific.

---

## Tradeoffs and what I'd do with more time

- **Voice-activity-aware chunking.** Right now we cut every 30s regardless of whether the speaker is mid-sentence. A VAD-aware chunker would trim silences and split on natural pauses, improving Whisper accuracy and giving the suggestions prompt cleaner sentences. Not worth the complexity for a 10-day take-home.
- **Speaker diarization.** Whisper alone returns a single text stream. For multi-party meetings, Groq's transcribe doesn't yet expose diarization in this model — adding it would mean a separate diarizer pipeline.
- **Adaptive context windows.** `suggestionsContextChars` is fixed. A smarter version would expand the window early in the meeting (when there's not much to look at) and contract once topic structure forms.
- **Tool-use / structured outputs.** I went with JSON mode + Zod validation for portability and tolerant parsing. If we committed to Groq's tool-call schema, we'd get stricter typing and slightly tighter outputs at the cost of some prompt readability.
- **Semantic dedupe of past suggestions.** Right now I pass the previous 2 batches' previews as plain text to suppress repeats. A small embedding model could catch near-duplicates the model paraphrases past the literal-text dedupe.
- **Better Whisper hallucination handling.** Today's filter is a hand-tuned blocklist. A confidence-based threshold (skip chunks where Whisper's avg logprob is too low) would generalize better.

---

## Defending the prompt-engineering choices

- **Why 5 suggestion types, not fewer?** Three types (`question`, `point`, `fact`) covers most cases but loses sharpness. `answer` and `clarification` are distinct enough in shape that collapsing them into the others made previews vaguer. Five gives the model a clear menu and the user a clear color code.
- **Why pass previous batches as previews, not full cards?** Smaller context, and the preview is what the user already saw — that's the thing we need to not repeat. The `detail_seed` is internal and fine to vary across batches.
- **Why `temperature: 0.5` for suggestions?** At 0 the model returns very similar batches across reloads. At 0.7 the JSON shape sometimes drifts. 0.5 gave the best variety/format reliability ratio in my testing.
- **Why same `gpt-oss-120b` for both panels?** The assignment fixes the model. Even without that constraint, on Groq the latency is fast enough (~500+ tok/s) that there's no quality argument for splitting models.
- **Why client-side `localStorage` for the key, not session-only memory?** UX. The user pastes once and reloads still work. Same pattern that ChatGPT API playgrounds, Cursor, etc. use.
- **Why drive suggestions off transcript-arrival instead of a wall-clock timer?** Tighter feedback loop ("right after I see new transcript, suggestions update"), no drift between panels, no risk of a redundant API call when nothing new came in (silence). One cadence, one source of truth.
- **Why a Whisper hallucination filter at all?** Without it, "Thanks for watching!" lines from Whisper-on-silence end up in the suggestions context, making the model think the meeting is ending and producing weird closing-themed suggestions. Empirically, filtering ~10 known patterns kept the suggestions on-topic.

---

## License

Built for the TwinMind take-home. Treat as a private submission.
