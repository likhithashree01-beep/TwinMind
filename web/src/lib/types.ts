export type TranscriptChunk = {
  id: string;
  ts: number;
  text: string;
};

export type SuggestionType =
  | "question_to_ask"
  | "talking_point"
  | "answer"
  | "fact_check"
  | "clarification";

export type Suggestion = {
  id: string;
  type: SuggestionType;
  preview: string;
  detail_seed: string;
};

export type SuggestionBatch = {
  id: string;
  ts: number;
  items: Suggestion[];
};

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  ts: number;
  content: string;
  sourceSuggestion?: Suggestion;
  streaming?: boolean;
};

export type Settings = {
  apiKey: string;
  suggestionsPrompt: string;
  detailedAnswerPrompt: string;
  chatPrompt: string;
  suggestionsContextChars: number;
  chatContextChars: number;
  refreshIntervalSec: number;
};

export type SessionExport = {
  startedAt: number;
  exportedAt: number;
  transcript: TranscriptChunk[];
  suggestionBatches: SuggestionBatch[];
  chat: ChatMessage[];
};
