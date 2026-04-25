"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useSession, useSettings } from "@/lib/store";
import { fullTranscriptText } from "@/lib/hooks";
import { streamChat } from "@/lib/api";
import { formatClockTime, formatGroqError } from "@/lib/format";
import type { Suggestion } from "@/lib/types";
import { Panel } from "./Panel";
import { Markdown } from "./Markdown";

export type ChatPanelHandle = {
  expandSuggestion: (s: Suggestion) => Promise<void>;
};

export const ChatPanel = forwardRef<ChatPanelHandle>(function ChatPanel(_, ref) {
  const chat = useSession((s) => s.chat);
  const pushChatMessage = useSession((s) => s.pushChatMessage);
  const appendToChatMessage = useSession((s) => s.appendToChatMessage);
  const finalizeChatMessage = useSession((s) => s.finalizeChatMessage);
  const setError = useSession((s) => s.setError);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);

  useEffect(() => {
    const el = scrollerRef.current?.closest(".panel-scroll");
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length, chat.at(-1)?.content, streaming]);

  async function runChat(args: {
    mode: "detailed" | "chat";
    userMessage: string;
    clickedSuggestion?: Suggestion;
  }) {
    const { settings } = useSettings.getState();
    if (!settings.apiKey) {
      setError("Add your Groq API key in Settings before chatting.");
      return;
    }
    const session = useSession.getState();
    const userId = randomId();
    pushChatMessage({
      id: userId,
      role: "user",
      ts: Date.now(),
      content: args.userMessage,
      sourceSuggestion: args.clickedSuggestion,
    });
    const assistantId = randomId();
    pushChatMessage({
      id: assistantId,
      role: "assistant",
      ts: Date.now(),
      content: "",
      streaming: true,
    });
    setStreaming(true);
    try {
      const fullTranscript = fullTranscriptText(
        session.transcript,
        settings.chatContextChars,
      );
      const history = session.chat
        .filter((m) => !m.streaming && m.content.length > 0)
        .map((m) => ({ role: m.role, content: m.content }));
      const systemPrompt =
        args.mode === "detailed"
          ? settings.detailedAnswerPrompt
          : settings.chatPrompt;
      await streamChat(
        settings.apiKey,
        {
          mode: args.mode,
          fullTranscript,
          history,
          userMessage: args.userMessage,
          clickedSuggestion: args.clickedSuggestion,
          systemPrompt,
        },
        (delta) => appendToChatMessage(assistantId, delta),
      );
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Chat failed";
      const friendly = formatGroqError("Chat", raw);
      appendToChatMessage(assistantId, `\n\n_${friendly}_`);
      setError(friendly);
    } finally {
      finalizeChatMessage(assistantId);
      setStreaming(false);
    }
  }

  useImperativeHandle(ref, () => ({
    async expandSuggestion(s: Suggestion) {
      await runChat({
        mode: "detailed",
        userMessage: s.preview,
        clickedSuggestion: s,
      });
    },
  }));

  async function onSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    await runChat({ mode: "chat", userMessage: text });
  }

  return (
    <Panel
      title="3. Chat (Detailed Answers)"
      rightLabel="Session-only"
      footer={
        <form
          onSubmit={onSubmit}
          className="flex items-center gap-2 px-4 py-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything…"
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-[14px] text-[var(--text)] placeholder:text-[var(--text-faint)] outline-none focus:border-[var(--accent)]/50"
            disabled={streaming}
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-md bg-[var(--accent)]/90 px-4 py-2 text-[13px] font-medium text-black transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {streaming ? "…" : "Send"}
          </button>
        </form>
      }
    >
      <div className="flex flex-col gap-4 px-5 py-4 pb-3">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--panel-2)] px-4 py-3 text-[13px] leading-relaxed text-[var(--text-dim)]">
          Tap a suggestion to add it here and stream a detailed answer
          (separate, longer-form prompt with full transcript context). You can
          also type questions directly. One continuous chat per session — no
          login, no persistence.
        </div>

        {chat.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-[var(--text-faint)]">
            Click a suggestion or type a question below.
          </div>
        ) : null}

        {chat.map((m) => (
          <div key={m.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[10px] tracking-[0.18em] text-[var(--text-faint)] uppercase">
              <span>{m.role === "user" ? "You" : "Assistant"}</span>
              {m.sourceSuggestion ? (
                <span className="text-[var(--text-faint)]">
                  · {labelFor(m.sourceSuggestion.type)}
                </span>
              ) : null}
              <span className="ml-auto font-mono text-[10px]">
                {formatClockTime(m.ts)}
              </span>
            </div>
            <div
              className={`rounded-lg border px-4 py-3 text-[14px] leading-relaxed ${
                m.role === "user"
                  ? "border-[var(--border)] bg-[var(--panel-2)] text-[var(--text)] whitespace-pre-wrap"
                  : "border-[var(--border)] bg-[var(--panel-2)]/60 text-[var(--text)]"
              }`}
            >
              {m.content ? (
                m.role === "assistant" ? (
                  <Markdown>{m.content}</Markdown>
                ) : (
                  m.content
                )
              ) : (
                <span className="text-[var(--text-faint)]">…</span>
              )}
              {m.streaming ? (
                <span className="ml-1 inline-block h-3 w-1.5 -translate-y-px animate-pulse bg-[var(--accent)]/70 align-middle" />
              ) : null}
            </div>
          </div>
        ))}
        <div ref={scrollerRef} />
      </div>
    </Panel>
  );
});

function labelFor(t: Suggestion["type"]) {
  switch (t) {
    case "question_to_ask":
      return "Question to ask";
    case "talking_point":
      return "Talking point";
    case "answer":
      return "Answer";
    case "fact_check":
      return "Fact-check";
    case "clarification":
      return "Clarification";
  }
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
