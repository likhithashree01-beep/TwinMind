import { z } from "zod";

export const suggestionTypeSchema = z.enum([
  "question_to_ask",
  "talking_point",
  "answer",
  "fact_check",
  "clarification",
]);

export const suggestionItemSchema = z.object({
  type: suggestionTypeSchema,
  preview: z.string().min(1).max(400),
  detail_seed: z.string().min(1).max(400),
});

export const suggestionsResponseSchema = z.object({
  items: z.array(suggestionItemSchema).min(1).max(5),
});

export type SuggestionItem = z.infer<typeof suggestionItemSchema>;
