"use client";

import type { AppSettings } from "@/lib/types";

interface SettingsDrawerProps {
  open: boolean;
  settings: AppSettings;
  validationState: "idle" | "checking" | "valid" | "invalid";
  onClose: () => void;
  onChange: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onValidateKey: () => void;
}

export function SettingsDrawer({
  open,
  settings,
  validationState,
  onClose,
  onChange,
  onValidateKey,
}: SettingsDrawerProps) {
  return (
    <div className={`settings-shell ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="settings-backdrop" onClick={onClose} />
      <aside className="settings-drawer">
        <div className="settings-head">
          <div>
            <h2>Settings</h2>
            <p>Groq key, prompts, windows, and latency controls.</p>
          </div>
          <button className="ghost-btn" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="settings-grid">
          <label className="field">
            <span>Groq API Key</span>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(event) => onChange("apiKey", event.target.value)}
              placeholder="gsk_..."
            />
          </label>

          <div className="inline-actions">
            <button className="accent-btn" onClick={onValidateKey} type="button">
              Validate key
            </button>
            <span className={`validation-pill ${validationState}`}>{validationState}</span>
          </div>

          <label className="field">
            <span>Transcript language</span>
            <input
              value={settings.language}
              onChange={(event) => onChange("language", event.target.value)}
              placeholder="en"
            />
          </label>

          <label className="field">
            <span>Refresh interval (seconds)</span>
            <input
              type="number"
              min={10}
              max={120}
              value={settings.refreshIntervalSeconds}
              onChange={(event) => onChange("refreshIntervalSeconds", Number(event.target.value))}
            />
          </label>

          <label className="field">
            <span>Suggestion transcript window (chunks)</span>
            <input
              type="number"
              min={2}
              max={30}
              value={settings.suggestionTranscriptWindow}
              onChange={(event) => onChange("suggestionTranscriptWindow", Number(event.target.value))}
            />
          </label>

          <label className="field">
            <span>Expanded answer transcript window (chunks)</span>
            <input
              type="number"
              min={4}
              max={60}
              value={settings.answerTranscriptWindow}
              onChange={(event) => onChange("answerTranscriptWindow", Number(event.target.value))}
            />
          </label>

          <label className="field">
            <span>Chat history window (messages)</span>
            <input
              type="number"
              min={2}
              max={30}
              value={settings.chatHistoryWindow}
              onChange={(event) => onChange("chatHistoryWindow", Number(event.target.value))}
            />
          </label>

          <label className="field">
            <span>Suggestion reasoning effort</span>
            <select
              value={settings.suggestionReasoningEffort}
              onChange={(event) =>
                onChange("suggestionReasoningEffort", event.target.value as AppSettings["suggestionReasoningEffort"])
              }
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>

          <label className="field">
            <span>Chat reasoning effort</span>
            <select
              value={settings.chatReasoningEffort}
              onChange={(event) => onChange("chatReasoningEffort", event.target.value as AppSettings["chatReasoningEffort"])}
            >
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
          </label>

          <label className="field">
            <span>Suggestion max output tokens</span>
            <input
              type="number"
              min={300}
              max={3000}
              value={settings.suggestionMaxOutputTokens}
              onChange={(event) => onChange("suggestionMaxOutputTokens", Number(event.target.value))}
            />
          </label>

          <label className="field">
            <span>Chat max output tokens</span>
            <input
              type="number"
              min={400}
              max={4000}
              value={settings.chatMaxOutputTokens}
              onChange={(event) => onChange("chatMaxOutputTokens", Number(event.target.value))}
            />
          </label>

          <label className="field field-full">
            <span>Live suggestion prompt</span>
            <textarea
              rows={6}
              value={settings.liveSuggestionPrompt}
              onChange={(event) => onChange("liveSuggestionPrompt", event.target.value)}
            />
          </label>

          <label className="field field-full">
            <span>Clicked suggestion prompt</span>
            <textarea
              rows={6}
              value={settings.clickedSuggestionPrompt}
              onChange={(event) => onChange("clickedSuggestionPrompt", event.target.value)}
            />
          </label>

          <label className="field field-full">
            <span>Direct chat prompt</span>
            <textarea
              rows={6}
              value={settings.directChatPrompt}
              onChange={(event) => onChange("directChatPrompt", event.target.value)}
            />
          </label>

          <label className="field field-full">
            <span>Transcription bias prompt</span>
            <textarea
              rows={4}
              value={settings.transcriptionBiasPrompt}
              onChange={(event) => onChange("transcriptionBiasPrompt", event.target.value)}
            />
          </label>
        </div>
      </aside>
    </div>
  );
}
