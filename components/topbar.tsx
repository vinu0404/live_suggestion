interface TopbarProps {
  onOpenSettings: () => void;
  onExport: () => void;
  validationState: "idle" | "checking" | "valid" | "invalid";
  lastRefreshLatencyMs?: number;
  lastChatLatencyMs?: number;
}

export function Topbar({
  onOpenSettings,
  onExport,
  validationState,
  lastRefreshLatencyMs,
  lastChatLatencyMs,
}: TopbarProps) {
  return (
    <div className="topbar">
      <div>
        <h1>Live Meeting Copilot</h1>
        <div className="meta">Groq Whisper Large V3 · GPT-OSS 120B · Transcript · Suggestions · Chat</div>
      </div>
      <div className="topbar-actions">
        <span className={`validation-pill ${validationState}`}>key {validationState}</span>
        <span className="metric-pill">
          refresh {lastRefreshLatencyMs ? `${Math.round(lastRefreshLatencyMs)}ms` : "—"}
        </span>
        <span className="metric-pill">
          first token {lastChatLatencyMs ? `${Math.round(lastChatLatencyMs)}ms` : "—"}
        </span>
        <button className="ghost-btn" onClick={onExport} type="button">
          Export
        </button>
        <button className="accent-btn" onClick={onOpenSettings} type="button">
          Settings
        </button>
      </div>
    </div>
  );
}
