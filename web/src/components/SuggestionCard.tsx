"use client";

import type { Suggestion, SuggestionType } from "@/lib/types";

const TYPE_META: Record<
  SuggestionType,
  { label: string; color: string; ring: string }
> = {
  question_to_ask: {
    label: "Question to ask",
    color: "text-[#93c5fd]",
    ring: "border-[#93c5fd]/40 hover:border-[#93c5fd]/70",
  },
  talking_point: {
    label: "Talking point",
    color: "text-[#c4b5fd]",
    ring: "border-[#c4b5fd]/40 hover:border-[#c4b5fd]/70",
  },
  answer: {
    label: "Answer",
    color: "text-[#86efac]",
    ring: "border-[#86efac]/40 hover:border-[#86efac]/70",
  },
  fact_check: {
    label: "Fact-check",
    color: "text-[#fcd34d]",
    ring: "border-[#fcd34d]/40 hover:border-[#fcd34d]/70",
  },
  clarification: {
    label: "Clarification",
    color: "text-[#fda4af]",
    ring: "border-[#fda4af]/40 hover:border-[#fda4af]/70",
  },
};

export function SuggestionCard({
  suggestion,
  onClick,
  faded,
}: {
  suggestion: Suggestion;
  onClick: (s: Suggestion) => void;
  faded?: boolean;
}) {
  const meta = TYPE_META[suggestion.type] ?? TYPE_META.talking_point;
  return (
    <button
      type="button"
      onClick={() => onClick(suggestion)}
      className={`group flex w-full flex-col gap-2 rounded-lg border bg-[var(--panel-2)] px-4 py-3 text-left transition ${meta.ring} ${
        faded ? "opacity-55 hover:opacity-90" : ""
      }`}
    >
      <span
        className={`text-[10px] font-semibold tracking-[0.18em] uppercase ${meta.color}`}
      >
        {meta.label}
      </span>
      <span className="text-[14px] leading-relaxed text-[var(--text)]">
        {suggestion.preview}
      </span>
    </button>
  );
}
