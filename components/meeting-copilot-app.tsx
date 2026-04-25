"use client";

import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChatPanel } from "@/components/chat-panel";
import { SettingsDrawer } from "@/components/settings-drawer";
import { SuggestionsPanel } from "@/components/suggestions-panel";
import { Topbar } from "@/components/topbar";
import { TranscriptPanel } from "@/components/transcript-panel";
import { getSupportedAudioMimeType } from "@/lib/audio";
import { DEFAULT_SETTINGS, EMPTY_MEMORY } from "@/lib/defaults";
import { buildSessionExport } from "@/lib/export-session";
import type {
  AppSettings,
  ChatMessage,
  FailureEvent,
  RollingMeetingMemory,
  SessionMetrics,
  Suggestion,
  SuggestionBatch,
  TranscriptChunk,
} from "@/lib/types";
import { clamp, createId, downloadTextFile, nowIso } from "@/lib/utils";

const SESSION_STORAGE_KEY = "live-meeting-copilot:groq-api-key";

function parseSseDeltaContent(payload: string) {
  try {
    const parsed = JSON.parse(payload) as {
      choices?: Array<{
        delta?: {
          content?: string | Array<{ text?: string; type?: string }>;
        };
      }>;
    };

    const delta = parsed.choices?.[0]?.delta?.content;

    if (typeof delta === "string") {
      return delta;
    }

    if (Array.isArray(delta)) {
      return delta
        .map((part) => ("text" in part ? part.text ?? "" : ""))
        .join("");
    }
  } catch {
    return "";
  }

  return "";
}

export function MeetingCopilotApp() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [validationState, setValidationState] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [recording, setRecording] = useState(false);
  const [recorderStatus, setRecorderStatus] = useState("Click mic to start. Transcript appends every ~30s.");
  const [transcript, setTranscript] = useState<TranscriptChunk[]>([]);
  const [suggestionBatches, setSuggestionBatches] = useState<SuggestionBatch[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [rollingMemory, setRollingMemory] = useState<RollingMeetingMemory>(EMPTY_MEMORY);
  const [countdown, setCountdown] = useState(DEFAULT_SETTINGS.refreshIntervalSeconds);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [failures, setFailures] = useState<FailureEvent[]>([]);
  const [metrics, setMetrics] = useState<SessionMetrics>({
    refreshLatencyMs: [],
    chatFirstTokenLatencyMs: [],
  });

  const sessionStartedAt = useMemo(() => nowIso(), []);

  const settingsRef = useRef(settings);
  const transcriptRef = useRef(transcript);
  const suggestionBatchesRef = useRef(suggestionBatches);
  const chatRef = useRef(chat);
  const rollingMemoryRef = useRef(rollingMemory);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const pendingAudioBlobsRef = useRef<Blob[]>([]);
  const pendingSegmentStartedAtRef = useRef<number | null>(null);
  const memoryRefreshInFlightRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const transcriptBodyRef = useRef<HTMLDivElement | null>(null);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const storedKey = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (storedKey) {
      setSettings((previous) => ({
        ...previous,
        apiKey: storedKey,
      }));
      setValidationState("idle");
    }
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
    if (settings.apiKey) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, settings.apiKey);
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [settings]);

  useEffect(() => {
    transcriptRef.current = transcript;
    transcriptBodyRef.current?.scrollTo({
      top: transcriptBodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript]);

  useEffect(() => {
    suggestionBatchesRef.current = suggestionBatches;
  }, [suggestionBatches]);

  useEffect(() => {
    chatRef.current = chat;
    chatBodyRef.current?.scrollTo({
      top: chatBodyRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chat]);

  useEffect(() => {
    rollingMemoryRef.current = rollingMemory;
  }, [rollingMemory]);

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
      }

      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function appendFailure(kind: FailureEvent["kind"], message: string, retried = false) {
    startTransition(() => {
      setFailures((previous) => [
        {
          id: createId("failure"),
          timestamp: nowIso(),
          kind,
          message,
          retried,
        },
        ...previous,
      ]);
    });
  }

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((previous) => ({
      ...previous,
      [key]:
        typeof value === "number"
          ? clamp(value, 1, 10_000)
          : value,
    }));
  }

  async function validateApiKey() {
    if (!settingsRef.current.apiKey) {
      setValidationState("invalid");
      appendFailure("validation", "Paste a Groq API key before validating.");
      return;
    }

    setValidationState("checking");

    try {
      const response = await fetch("/api/validate-key", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: settingsRef.current.apiKey,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Key validation failed.");
      }

      setValidationState("valid");
    } catch (error) {
      setValidationState("invalid");
      appendFailure("validation", error instanceof Error ? error.message : "Key validation failed.");
    }
  }

  function startCountdownLoop() {
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
    }

    setCountdown(settingsRef.current.refreshIntervalSeconds);
    countdownIntervalRef.current = window.setInterval(() => {
      setCountdown((previous) => {
        if (previous <= 1) {
          void refreshSession("auto");
          return settingsRef.current.refreshIntervalSeconds;
        }

        return previous - 1;
      });
    }, 1000);
  }

  async function toggleRecording() {
    if (recording) {
      setRecording(false);
      setRecorderStatus("Stopping… flushing any pending audio.");
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        await new Promise<void>((resolve) => {
          mediaRecorderRef.current?.addEventListener(
            "stop",
            () => resolve(),
            { once: true },
          );
          mediaRecorderRef.current?.stop();
        });
      }

      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      await refreshSession("stop");
      setRecorderStatus("Stopped. Click to resume.");
      return;
    }

    if (!settingsRef.current.apiKey) {
      setSettingsOpen(true);
      appendFailure("validation", "Add a Groq API key before starting the mic.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      pendingAudioBlobsRef.current = [];
      pendingSegmentStartedAtRef.current = Date.now();
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          pendingAudioBlobsRef.current.push(event.data);
        }
      };

      recorder.start(1000);
      setRecording(true);
      setRecorderStatus("Listening… transcript and suggestions update every ~30s.");
      startCountdownLoop();
    } catch (error) {
      appendFailure("transcription", error instanceof Error ? error.message : "Unable to access the microphone.");
      setRecorderStatus("Mic access failed. Check browser permissions and try again.");
    }
  }

  async function flushPendingAudio() {
    if (pendingAudioBlobsRef.current.length === 0) {
      return null;
    }

    const startedAtMs = pendingSegmentStartedAtRef.current ?? Date.now();
    const endedAtMs = Date.now();
    const mimeType = pendingAudioBlobsRef.current[0]?.type || "audio/webm";
    const fileExtension = mimeType.includes("mp4") ? "mp4" : "webm";
    const blob = new Blob(pendingAudioBlobsRef.current, { type: mimeType });
    pendingAudioBlobsRef.current = [];
    pendingSegmentStartedAtRef.current = endedAtMs;

    const formData = new FormData();
    formData.append("apiKey", settingsRef.current.apiKey);
    formData.append("language", settingsRef.current.language);
    formData.append("prompt", settingsRef.current.transcriptionBiasPrompt);
    formData.append("startedAtMs", String(startedAtMs));
    formData.append("endedAtMs", String(endedAtMs));
    formData.append("file", new File([blob], `segment.${fileExtension}`, { type: mimeType }));

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      throw new Error(data.error ?? "Transcription failed.");
    }

    const data = (await response.json()) as { chunk: TranscriptChunk };

    if (!data.chunk.text.trim()) {
      return null;
    }

    return data.chunk;
  }

  async function refreshRollingMemory(transcriptSnapshot: TranscriptChunk[]) {
    if (memoryRefreshInFlightRef.current || transcriptSnapshot.length < 3 || !settingsRef.current.apiKey) {
      return;
    }

    const shouldRefresh =
      transcriptSnapshot.length % 3 === 0 ||
      transcriptSnapshot.length >= settingsRef.current.answerTranscriptWindow;

    if (!shouldRefresh) {
      return;
    }

    memoryRefreshInFlightRef.current = true;

    try {
      const response = await fetch("/api/memory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: settingsRef.current.apiKey,
          transcript: transcriptSnapshot,
          rollingMemory: rollingMemoryRef.current,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Memory refresh failed.");
      }

      const data = (await response.json()) as { memory: RollingMeetingMemory };
      setRollingMemory(data.memory);
    } catch (error) {
      appendFailure("memory", error instanceof Error ? error.message : "Memory refresh failed.");
    } finally {
      memoryRefreshInFlightRef.current = false;
    }
  }

  async function refreshSession(reason: SuggestionBatch["refreshReason"]) {
    if (refreshInFlightRef.current || !settingsRef.current.apiKey) {
      return;
    }

    refreshInFlightRef.current = true;
    setIsRefreshing(true);
    const refreshStartedAt = performance.now();

    try {
      const flushedChunk = await flushPendingAudio();
      const transcriptSnapshot = flushedChunk
        ? [...transcriptRef.current, flushedChunk]
        : transcriptRef.current;

      if (flushedChunk) {
        startTransition(() => {
          setTranscript((previous) => [...previous, flushedChunk]);
        });
      }

      if (transcriptSnapshot.length === 0) {
        setCountdown(settingsRef.current.refreshIntervalSeconds);
        return;
      }

      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          settings: settingsRef.current,
          transcript: transcriptSnapshot,
          recentBatches: suggestionBatchesRef.current,
          rollingMemory: rollingMemoryRef.current,
          refreshReason: reason,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Suggestion refresh failed.");
      }

      const data = (await response.json()) as { batch: SuggestionBatch };

      startTransition(() => {
        setSuggestionBatches((previous) => [data.batch, ...previous]);
        setMetrics((previous) => ({
          ...previous,
          refreshLatencyMs: [...previous.refreshLatencyMs, performance.now() - refreshStartedAt],
        }));
      });

      setCountdown(settingsRef.current.refreshIntervalSeconds);
      void refreshRollingMemory(transcriptSnapshot);
    } catch (error) {
      appendFailure("suggestions", error instanceof Error ? error.message : "Suggestion refresh failed.");
    } finally {
      refreshInFlightRef.current = false;
      setIsRefreshing(false);
    }
  }

  function updateAssistantMessage(messageId: string, text: string, status: ChatMessage["status"]) {
    startTransition(() => {
      setChat((previous) =>
        previous.map((message) =>
          message.id === messageId
            ? {
                ...message,
                text,
                status,
              }
            : message,
        ),
      );
    });
  }

  async function streamChatResponse(params: {
    question: string;
    source: ChatMessage["source"];
    suggestion?: Suggestion;
  }) {
    if (isSendingChat || !settingsRef.current.apiKey) {
      return;
    }

    const trimmedQuestion = params.question.trim();
    if (!trimmedQuestion) {
      return;
    }

    setIsSendingChat(true);

    const userMessage: ChatMessage = {
      id: createId("chat"),
      role: "user",
      source: params.source,
      text: trimmedQuestion,
      timestamp: nowIso(),
      suggestionId: params.suggestion?.id,
      suggestionKind: params.suggestion?.kind,
      status: "done",
    };

    const assistantMessageId = createId("chat");
    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      source: params.source,
      text: "",
      timestamp: nowIso(),
      status: "streaming",
    };

    startTransition(() => {
      setChat((previous) => [...previous, userMessage, assistantPlaceholder]);
    });

    const chatStartedAt = performance.now();
    let firstTokenRecorded = false;
    let assistantText = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          settings: settingsRef.current,
          transcript: transcriptRef.current,
          rollingMemory: rollingMemoryRef.current,
          history: [...chatRef.current, userMessage],
          question: trimmedQuestion,
          mode: params.source === "suggestion" ? "suggestion" : "typed",
        }),
      });

      if (!response.ok || !response.body) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Chat request failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");

        while (boundary !== -1) {
          const packet = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");

          const lines = packet.split("\n");
          for (const line of lines) {
            if (!line.startsWith("data:")) {
              continue;
            }

            const payload = line.slice(5).trim();

            if (!payload || payload === "[DONE]") {
              continue;
            }

            const token = parseSseDeltaContent(payload);
            if (!token) {
              continue;
            }

            if (!firstTokenRecorded) {
              firstTokenRecorded = true;
              setMetrics((previous) => ({
                ...previous,
                chatFirstTokenLatencyMs: [...previous.chatFirstTokenLatencyMs, performance.now() - chatStartedAt],
              }));
            }

            assistantText += token;
            updateAssistantMessage(assistantMessageId, assistantText, "streaming");
          }
        }
      }

      updateAssistantMessage(assistantMessageId, assistantText, "done");
    } catch (error) {
      updateAssistantMessage(
        assistantMessageId,
        assistantText || "Something went wrong while streaming the answer.",
        "error",
      );
      appendFailure("chat", error instanceof Error ? error.message : "Chat request failed.");
    } finally {
      setIsSendingChat(false);
      setChatInput("");
    }
  }

  function exportSession() {
    const payload = buildSessionExport({
      sessionStartedAt,
      settings: settingsRef.current,
      transcript: transcriptRef.current,
      suggestionBatches: suggestionBatchesRef.current,
      chatHistory: chatRef.current,
      rollingMemory: rollingMemoryRef.current,
      metrics,
      failures,
    });

    downloadTextFile(
      `meeting-copilot-session-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      JSON.stringify(payload, null, 2),
    );
  }

  const lastRefreshLatencyMs = metrics.refreshLatencyMs.at(-1);
  const lastChatLatencyMs = metrics.chatFirstTokenLatencyMs.at(-1);

  return (
    <>
      <Topbar
        onOpenSettings={() => setSettingsOpen(true)}
        onExport={exportSession}
        validationState={validationState}
        lastRefreshLatencyMs={lastRefreshLatencyMs}
        lastChatLatencyMs={lastChatLatencyMs}
      />

      <main className="layout">
        <TranscriptPanel
          bodyRef={transcriptBodyRef}
          recording={recording}
          transcript={transcript}
          statusText={recorderStatus}
          onToggleRecording={toggleRecording}
        />
        <SuggestionsPanel
          batches={suggestionBatches}
          countdown={countdown}
          isRefreshing={isRefreshing}
          onRefresh={() => void refreshSession("manual")}
          onSuggestionClick={(suggestion) =>
            void streamChatResponse({
              question: suggestion.preview,
              source: "suggestion",
              suggestion,
            })
          }
        />
        <ChatPanel
          bodyRef={chatBodyRef}
          chat={chat}
          input={chatInput}
          isSending={isSendingChat}
          onInputChange={setChatInput}
          onSubmit={() =>
            void streamChatResponse({
              question: chatInput,
              source: "typed",
            })
          }
        />
      </main>

      {failures.length > 0 ? (
        <section className="error-strip">
          {failures.slice(0, 3).map((failure) => (
            <div className="error-pill" key={failure.id}>
              {failure.kind}: {failure.message}
            </div>
          ))}
        </section>
      ) : null}

      <SettingsDrawer
        open={settingsOpen}
        settings={settings}
        validationState={validationState}
        onClose={() => setSettingsOpen(false)}
        onChange={updateSetting}
        onValidateKey={() => void validateApiKey()}
      />
    </>
  );
}
