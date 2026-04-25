import type { RefObject } from "react";
import type { TranscriptChunk } from "@/lib/types";
import { formatClock } from "@/lib/utils";

interface TranscriptPanelProps {
  recording: boolean;
  transcript: TranscriptChunk[];
  statusText: string;
  onToggleRecording: () => void;
  bodyRef?: RefObject<HTMLDivElement | null>;
}

export function TranscriptPanel({
  recording,
  transcript,
  statusText,
  onToggleRecording,
  bodyRef,
}: TranscriptPanelProps) {
  return (
    <div className="col">
      <header>
        <span>1. Mic &amp; Transcript</span>
        <span>{recording ? "● recording" : "idle"}</span>
      </header>
      <div className="mic-wrap">
        <button
          className={`mic-btn ${recording ? "recording" : ""}`}
          onClick={onToggleRecording}
          title="Start / stop recording"
          type="button"
        >
          ●
        </button>
        <div className="mic-status">{statusText}</div>
      </div>
      <div className="body transcript-body" ref={bodyRef}>
        <div className="help-banner">
          The transcript appends in chunks roughly every 30 seconds while recording. Manual refresh flushes any pending
          audio first so suggestions stay aligned with what was just said.
        </div>
        {transcript.length === 0 ? (
          <div className="empty">No transcript yet — start the mic.</div>
        ) : (
          transcript.map((chunk) => (
            <div className="transcript-line new" key={chunk.id}>
              <span className="ts">{formatClock(chunk.timestamp)}</span>
              {chunk.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
