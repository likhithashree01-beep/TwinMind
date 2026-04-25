"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/lib/store";
import {
  DEFAULT_CHAT_PROMPT,
  DEFAULT_DETAILED_ANSWER_PROMPT,
  DEFAULT_SUGGESTIONS_PROMPT,
} from "@/lib/prompts";

export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const settings = useSettings((s) => s.settings);
  const updateSettings = useSettings((s) => s.updateSettings);
  const setApiKey = useSettings((s) => s.setApiKey);
  const resetPromptDefaults = useSettings((s) => s.resetPromptDefaults);

  const [draft, setDraft] = useState(settings);
  useEffect(() => {
    if (open) setDraft(settings);
  }, [open, settings]);

  if (!open) return null;

  const dirty =
    draft.apiKey !== settings.apiKey ||
    draft.suggestionsPrompt !== settings.suggestionsPrompt ||
    draft.detailedAnswerPrompt !== settings.detailedAnswerPrompt ||
    draft.chatPrompt !== settings.chatPrompt ||
    draft.suggestionsContextChars !== settings.suggestionsContextChars ||
    draft.chatContextChars !== settings.chatContextChars ||
    draft.refreshIntervalSec !== settings.refreshIntervalSec;

  function save() {
    setApiKey(draft.apiKey);
    updateSettings({
      suggestionsPrompt: draft.suggestionsPrompt,
      detailedAnswerPrompt: draft.detailedAnswerPrompt,
      chatPrompt: draft.chatPrompt,
      suggestionsContextChars: draft.suggestionsContextChars,
      chatContextChars: draft.chatContextChars,
      refreshIntervalSec: draft.refreshIntervalSec,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex w-full max-w-3xl flex-col max-h-screen sm:max-h-[90vh] rounded-none sm:rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <h2 className="text-[14px] font-semibold tracking-tight text-[var(--text)]">
            Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text)]"
          >
            Close
          </button>
        </div>

        <div className="panel-scroll flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
          <Field label="Groq API key" hint="Stored only in your browser (localStorage). Sent on each request to Groq via this app's backend.">
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={draft.apiKey}
              onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
              placeholder="gsk_..."
              className="w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-[14px] text-[var(--text)] outline-none focus:border-[var(--accent)]/50"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberField
              label="Auto-refresh (sec)"
              hint="Cadence for transcript chunks + suggestion batches."
              value={draft.refreshIntervalSec}
              min={10}
              max={120}
              onChange={(v) => setDraft({ ...draft, refreshIntervalSec: v })}
            />
            <NumberField
              label="Suggestions context (chars)"
              hint="Tail of transcript fed to the suggestions prompt."
              value={draft.suggestionsContextChars}
              min={500}
              max={20000}
              step={250}
              onChange={(v) => setDraft({ ...draft, suggestionsContextChars: v })}
            />
            <NumberField
              label="Chat context (chars)"
              hint="Transcript budget for detailed answers + chat."
              value={draft.chatContextChars}
              min={1000}
              max={60000}
              step={500}
              onChange={(v) => setDraft({ ...draft, chatContextChars: v })}
            />
          </div>

          <PromptField
            label="Live suggestions prompt"
            hint="System prompt for the every-30s suggestions generator. Must produce strict JSON with 3 typed items."
            value={draft.suggestionsPrompt}
            onChange={(v) => setDraft({ ...draft, suggestionsPrompt: v })}
            onReset={() =>
              setDraft({ ...draft, suggestionsPrompt: DEFAULT_SUGGESTIONS_PROMPT })
            }
          />
          <PromptField
            label="Detailed answer prompt (on suggestion click)"
            hint="System prompt used when the user taps a suggestion card. Streamed."
            value={draft.detailedAnswerPrompt}
            onChange={(v) => setDraft({ ...draft, detailedAnswerPrompt: v })}
            onReset={() =>
              setDraft({
                ...draft,
                detailedAnswerPrompt: DEFAULT_DETAILED_ANSWER_PROMPT,
              })
            }
          />
          <PromptField
            label="Chat prompt (typed questions)"
            hint="System prompt used when the user types a free-form question. Streamed."
            value={draft.chatPrompt}
            onChange={(v) => setDraft({ ...draft, chatPrompt: v })}
            onReset={() =>
              setDraft({ ...draft, chatPrompt: DEFAULT_CHAT_PROMPT })
            }
          />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] px-6 py-4">
          <button
            type="button"
            onClick={() => {
              resetPromptDefaults();
              setDraft({
                ...draft,
                suggestionsPrompt: DEFAULT_SUGGESTIONS_PROMPT,
                detailedAnswerPrompt: DEFAULT_DETAILED_ANSWER_PROMPT,
                chatPrompt: DEFAULT_CHAT_PROMPT,
              });
            }}
            className="text-[12px] text-[var(--text-faint)] hover:text-[var(--text)]"
          >
            Reset all prompts to defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-[12px] text-[var(--text-dim)] hover:border-[var(--accent)]/40 hover:text-[var(--text)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty}
              className="rounded-md bg-[var(--accent)]/90 px-4 py-1.5 text-[12px] font-medium text-black transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[12px] font-medium text-[var(--text)]">{label}</span>
      {children}
      {hint ? (
        <span className="text-[11px] text-[var(--text-faint)]">{hint}</span>
      ) : null}
    </label>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(n);
        }}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-[14px] text-[var(--text)] outline-none focus:border-[var(--accent)]/50"
      />
    </Field>
  );
}

function PromptField({
  label,
  hint,
  value,
  onChange,
  onReset,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-[var(--text)]">{label}</span>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] text-[var(--text-faint)] hover:text-[var(--text)]"
        >
          Reset to default
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        spellCheck={false}
        className="panel-scroll w-full resize-y rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 font-mono text-[12px] leading-relaxed text-[var(--text)] outline-none focus:border-[var(--accent)]/50"
      />
      {hint ? (
        <span className="text-[11px] text-[var(--text-faint)]">{hint}</span>
      ) : null}
    </div>
  );
}
