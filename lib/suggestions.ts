import { z } from "zod";
import type { Suggestion, SuggestionBatch } from "@/lib/types";
import { createId } from "@/lib/utils";

export const suggestionSchema = z.object({
  kind: z.enum(["question", "talking", "answer", "fact"]),
  preview: z.string().min(8).max(240),
  whyNow: z.string().min(8).max(240),
  quoteAnchor: z.string().min(3).max(120),
});

export const suggestionBatchSchema = z.object({
  suggestions: z.array(suggestionSchema).length(3),
});

export function normalizeSuggestionText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSuggestionDistinct(candidate: Suggestion, seen: Set<string>) {
  const normalized = normalizeSuggestionText(candidate.preview);
  if (!normalized) {
    return false;
  }

  for (const item of seen) {
    if (item === normalized) {
      return false;
    }

    if (item.includes(normalized) || normalized.includes(item)) {
      return false;
    }
  }

  return true;
}

export function collectRecentSuggestionSet(batches: SuggestionBatch[]) {
  const seen = new Set<string>();

  for (const batch of batches) {
    for (const suggestion of batch.suggestions) {
      seen.add(normalizeSuggestionText(suggestion.preview));
    }
  }

  return seen;
}

export function coerceSuggestionBatch(raw: unknown, createdAt: string, refreshReason: SuggestionBatch["refreshReason"]): SuggestionBatch {
  const parsed = suggestionBatchSchema.parse(raw);

  return {
    id: createId("batch"),
    createdAt,
    refreshReason,
    suggestions: parsed.suggestions.map((suggestion) => ({
      id: createId("suggestion"),
      ...suggestion,
    })),
  };
}
