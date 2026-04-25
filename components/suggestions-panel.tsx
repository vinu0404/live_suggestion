import { SUGGESTION_KIND_LABELS } from "@/lib/defaults";
import type { Suggestion, SuggestionBatch } from "@/lib/types";
import { formatClock } from "@/lib/utils";

interface SuggestionsPanelProps {
  batches: SuggestionBatch[];
  countdown: number;
  isRefreshing: boolean;
  onRefresh: () => void;
  onSuggestionClick: (suggestion: Suggestion) => void;
}

export function SuggestionsPanel({
  batches,
  countdown,
  isRefreshing,
  onRefresh,
  onSuggestionClick,
}: SuggestionsPanelProps) {
  return (
    <div className="col">
      <header>
        <span>2. Live Suggestions</span>
        <span>{batches.length} {batches.length === 1 ? "batch" : "batches"}</span>
      </header>
      <div className="reload-row">
        <button className="reload-btn" onClick={onRefresh} type="button" disabled={isRefreshing}>
          {isRefreshing ? "Refreshing..." : "↻ Reload suggestions"}
        </button>
        <span className="countdown">auto-refresh in {countdown}s</span>
      </div>
      <div className="body">
        <div className="help-banner">
          Every refresh produces exactly 3 fresh suggestions from recent transcript context. New batches land at the
          top, and older batches stay visible below as a trail of what the copilot surfaced.
        </div>
        {batches.length === 0 ? (
          <div className="empty">Suggestions appear here once recording starts or you refresh.</div>
        ) : (
          batches.map((batch, batchIndex) => (
            <div key={batch.id}>
              {batch.suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  className={`suggestion ${batchIndex === 0 ? "fresh" : "stale"}`}
                  type="button"
                  onClick={() => onSuggestionClick(suggestion)}
                >
                  <span className={`sug-tag ${suggestion.kind}`}>{SUGGESTION_KIND_LABELS[suggestion.kind]}</span>
                  <div className="sug-title">{suggestion.preview}</div>
                </button>
              ))}
              <div className="sug-batch-divider">Batch {batchIndex + 1} · {formatClock(batch.createdAt)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
