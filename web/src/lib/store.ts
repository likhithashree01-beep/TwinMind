"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ChatMessage,
  Settings,
  Suggestion,
  SuggestionBatch,
  TranscriptChunk,
} from "./types";
import { DEFAULT_SETTINGS } from "./prompts";

type SessionState = {
  startedAt: number;
  transcript: TranscriptChunk[];
  batches: SuggestionBatch[];
  chat: ChatMessage[];
  recording: boolean;
  transcribing: boolean;
  suggesting: boolean;
  lastSuggestionsAt: number | null;
  error: string | null;

  setRecording: (v: boolean) => void;
  setTranscribing: (v: boolean) => void;
  setSuggesting: (v: boolean) => void;
  setError: (e: string | null) => void;

  appendTranscript: (text: string, ts?: number) => void;
  pushBatch: (items: Suggestion[]) => void;
  pushChatMessage: (msg: ChatMessage) => void;
  appendToChatMessage: (id: string, delta: string) => void;
  finalizeChatMessage: (id: string) => void;
  setLastSuggestionsAt: (ts: number) => void;
  resetSession: () => void;
};

export const useSession = create<SessionState>((set) => ({
  startedAt: Date.now(),
  transcript: [],
  batches: [],
  chat: [],
  recording: false,
  transcribing: false,
  suggesting: false,
  lastSuggestionsAt: null,
  error: null,

  setRecording: (v) => set({ recording: v }),
  setTranscribing: (v) => set({ transcribing: v }),
  setSuggesting: (v) => set({ suggesting: v }),
  setError: (e) => set({ error: e }),

  appendTranscript: (text, ts) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    set((s) => ({
      transcript: [
        ...s.transcript,
        { id: cryptoRandom(), ts: ts ?? Date.now(), text: trimmed },
      ],
    }));
  },

  pushBatch: (items) =>
    set((s) => ({
      batches: [
        {
          id: cryptoRandom(),
          ts: Date.now(),
          items: items.map((it) => ({ ...it, id: cryptoRandom() })),
        },
        ...s.batches,
      ],
    })),

  pushChatMessage: (msg) => set((s) => ({ chat: [...s.chat, msg] })),

  appendToChatMessage: (id, delta) =>
    set((s) => ({
      chat: s.chat.map((m) =>
        m.id === id ? { ...m, content: m.content + delta } : m,
      ),
    })),

  finalizeChatMessage: (id) =>
    set((s) => ({
      chat: s.chat.map((m) => (m.id === id ? { ...m, streaming: false } : m)),
    })),

  setLastSuggestionsAt: (ts) => set({ lastSuggestionsAt: ts }),

  resetSession: () =>
    set({
      startedAt: Date.now(),
      transcript: [],
      batches: [],
      chat: [],
      recording: false,
      transcribing: false,
      suggesting: false,
      lastSuggestionsAt: null,
      error: null,
    }),
}));

type SettingsState = {
  settings: Settings;
  hydrated: boolean;
  setApiKey: (key: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetPromptDefaults: () => void;
  setHydrated: (v: boolean) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      hydrated: false,
      setApiKey: (key) =>
        set((s) => ({ settings: { ...s.settings, apiKey: key } })),
      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),
      resetPromptDefaults: () =>
        set((s) => ({
          settings: {
            ...s.settings,
            suggestionsPrompt: DEFAULT_SETTINGS.suggestionsPrompt,
            detailedAnswerPrompt: DEFAULT_SETTINGS.detailedAnswerPrompt,
            chatPrompt: DEFAULT_SETTINGS.chatPrompt,
            suggestionsContextChars: DEFAULT_SETTINGS.suggestionsContextChars,
            chatContextChars: DEFAULT_SETTINGS.chatContextChars,
            refreshIntervalSec: DEFAULT_SETTINGS.refreshIntervalSec,
          },
        })),
      setHydrated: (v) => set({ hydrated: v }),
    }),
    {
      name: "twinmind-settings",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

function cryptoRandom() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
