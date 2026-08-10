"use client";

import { useEffect, useRef, useState } from "react";

import { DesktopAnswerPanel } from "./overlay/desktop-answer-panel";
import { DesktopChatBar } from "./overlay/desktop-chat-bar";
import { DesktopOverlayToolbar } from "./overlay/desktop-overlay-toolbar";
import { DesktopTranscriptBar } from "./overlay/desktop-transcript-bar";

type DesktopOverlayProps = {
  initialLanguage: string;
  initialMode: string;
  initialModel: string;
  initialSessionId: string;
  initialTone: string;
};

const AUDIO_DEVICE_STORAGE_KEY = "kasa-cue:desktop-audio-input-device-id";
const SYSTEM_AUDIO_DEVICE_STORAGE_KEY =
  "kasa-cue:desktop-system-audio-input-device-id";
const RECORDING_SEGMENT_MS = 2500;
const AUTO_ANSWER_PAUSE_MS = 900;
const MIN_TRANSCRIPT_WORDS = 2;

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: {
      transcript: string;
    };
  }>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

export function DesktopOverlay({
  initialLanguage,
  initialMode,
  initialModel,
  initialSessionId,
  initialTone,
}: DesktopOverlayProps) {
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [transcript, setTranscript] = useState("");
  const [chatText, setChatText] = useState("");
  const [reply, setReply] = useState("");
  const [replyHistory, setReplyHistory] = useState<string[]>([]);
  const [replyHistoryIndex, setReplyHistoryIndex] = useState(-1);
  const [activeTool, setActiveTool] = useState<"answer" | "analyze" | "chat">(
    "answer"
  );
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [autoAnswer, setAutoAnswer] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSystemCapturing, setIsSystemCapturing] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [liveTranscriptPreview, setLiveTranscriptPreview] = useState("");
  const [durationLabel, setDurationLabel] = useState("0:00");
  const [opacity, setOpacity] = useState(0.92);
  const [copied, setCopied] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const revealTimerRef = useRef<number | null>(null);
  const microphoneRecorderRef = useRef<MediaRecorder | null>(null);
  const systemRecorderRef = useRef<MediaRecorder | null>(null);
  const systemCaptureStreamRef = useRef<MediaStream | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const autoAnswerRef = useRef(false);
  const didAutoStartAudioRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const sessionIdRef = useRef(initialSessionId);
  const transcriptRef = useRef("");
  const microphoneSegmentTimerRef = useRef<number | null>(null);
  const systemSegmentTimerRef = useRef<number | null>(null);
  const pendingTranscriptionsRef = useRef(0);
  const transcriptionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const autoAnswerTimerRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const isSystemUsingMicrophoneFallbackRef = useRef(false);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    const offSession = window.kasaDesktop?.onSession?.((payload) => {
      if (payload.sessionId) {
        setSessionId(payload.sessionId);
      }
    });

    return () => offSession?.();
  }, []);

  useEffect(() => {
    const previousHtmlBackground = document.documentElement.style.background;
    const previousBodyBackground = document.body.style.background;

    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";

    return () => {
      document.documentElement.style.background = previousHtmlBackground;
      document.body.style.background = previousBodyBackground;
    };
  }, []);

  useEffect(() => {
    autoAnswerRef.current = autoAnswer;
  }, [autoAnswer]);

  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  useEffect(() => {
    if (isCollapsed || isGenerating || reply.trim()) {
      return;
    }

    void window.kasaDesktop?.setOverlayMode?.(
      activeTool === "chat" ? "chat" : "compact"
    );
  }, [activeTool, isCollapsed, isGenerating, reply]);

  useEffect(() => {
    startedAtRef.current = Date.now();
    const intervalId = window.setInterval(() => {
      const startedAt = startedAtRef.current ?? Date.now();
      const totalSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      setDurationLabel(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    return () => {
      stopLiveRecorder(
        microphoneRecorderRef.current,
        microphoneStreamRef.current,
        microphoneSegmentTimerRef
      );
      stopLiveRecorder(
        systemRecorderRef.current,
        systemStreamRef.current,
        systemSegmentTimerRef
      );
      stopStream(systemCaptureStreamRef.current);
      stopSpeechPreview(speechRecognitionRef.current);
      if (autoAnswerTimerRef.current) {
        window.clearTimeout(autoAnswerTimerRef.current);
      }
    };
  }, []);

  async function generateReply(sourceText = transcript) {
    const nextTranscript = sourceText.trim();

    if (!nextTranscript || !sessionIdRef.current || isGeneratingRef.current) {
      return;
    }

    isGeneratingRef.current = true;
    setIsGenerating(true);
    setReply("");
    await window.kasaDesktop?.setOverlayMode?.("result");

    if (revealTimerRef.current) {
      window.clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    try {
      await saveUserTurn(nextTranscript);
      const response = await fetch("/api/openai/generate-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: initialLanguage,
          mode: initialMode,
          model: initialModel,
          responseLength: "adaptive",
          sessionId: sessionIdRef.current,
          stream: true,
          tone: initialTone,
          transcript: nextTranscript,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };

        throw new Error(data.error ?? "Could not generate answer.");
      }

      const text = await readStream(response);
      pushReplyHistory(text);

      await fetch(`/api/sessions/${sessionIdRef.current}/turns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: text,
          model: response.headers.get("X-Model") ?? initialModel,
          speaker: "assistant",
        }),
      });
    } catch (error) {
      await window.kasaDesktop?.setOverlayMode?.("result");
      setReply(
        error instanceof Error
          ? error.message
          : "Could not generate answer."
      );
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(false);
    }
  }

  async function sendChatMessage() {
    const message = chatText.trim();

    if (!message || isGenerating) {
      return;
    }

    setChatText("");
    setTranscript((current) => [current, `User: ${message}`].filter(Boolean).join("\n"));
    await generateReply(message);
  }

  async function analyzeScreen() {
    if (!sessionId || isGenerating) {
      return;
    }

    setIsGenerating(true);
    setReply("");

    try {
      if (transcript.trim()) {
        await saveUserTurn(transcript.trim());
      }

      const snapshot = await window.kasaDesktop?.getScreenSnapshot?.();
      const imageDataUrl = snapshot?.dataUrl;

      if (!imageDataUrl) {
        if (snapshot?.permissionRequired) {
          return;
        }

        throw new Error(
          snapshot?.error ??
            "Could not read the current screen. Allow Screen Recording for Kasa Cue once in macOS Settings."
        );
      }

      await window.kasaDesktop?.setOverlayMode?.("result");

      const response = await fetch("/api/openai/analyze-screen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageDataUrl,
          prompt: transcript.trim(),
          sessionId,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        model?: string;
        reply?: string;
      };

      if (!response.ok || !data.reply) {
        throw new Error(data.error ?? "Could not analyze screen.");
      }

      await revealText(data.reply);
      pushReplyHistory(data.reply);
      await saveAssistantTurn(data.reply, data.model ?? "screen-analysis");
    } catch (error) {
      await window.kasaDesktop?.setOverlayMode?.("result");
      setReply(
        error instanceof Error
          ? error.message
          : "Could not analyze screen."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function toggleSystemCapture() {
    if (isSystemCapturing) {
      stopLiveRecorder(
        systemRecorderRef.current,
        systemStreamRef.current,
        systemSegmentTimerRef
      );
      stopStream(systemCaptureStreamRef.current);
      systemRecorderRef.current = null;
      systemCaptureStreamRef.current = null;
      systemStreamRef.current = null;
      isSystemUsingMicrophoneFallbackRef.current = false;
      setIsSystemCapturing(false);
      return;
    }

    try {
      const platform = await window.kasaDesktop?.getPlatform?.();
      const { captureStream, isMicrophoneFallback, stream } =
        await getSystemAudioStream(platform);

      if (
        isMicrophoneFallback &&
        hasLiveAudioTracks(microphoneStreamRef.current)
      ) {
        stopStream(stream);
        isSystemUsingMicrophoneFallbackRef.current = true;
        setIsSystemCapturing(true);
        return;
      }

      systemCaptureStreamRef.current = captureStream;
      systemStreamRef.current = stream;
      isSystemUsingMicrophoneFallbackRef.current = isMicrophoneFallback;
      systemRecorderRef.current = startSegmentRecorder(stream, "system");
      setIsSystemCapturing(true);
    } catch (error) {
      await window.kasaDesktop?.setOverlayMode?.("result");
      setReply(
        error instanceof Error
          ? `System audio capture failed: ${error.message}`
          : "System audio capture failed."
      );
    }
  }

  function startSegmentRecorder(
    stream: MediaStream,
    source: "microphone" | "system"
  ) {
    const mimeType = pickSupportedMimeType();
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );
    const timerRef =
      source === "microphone" ? microphoneSegmentTimerRef : systemSegmentTimerRef;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });

      if (blob.size > 1000) {
        transcriptionQueueRef.current = transcriptionQueueRef.current
          .catch(() => undefined)
          .then(() => transcribeChunk(blob, source));
      }

      if (stream.getAudioTracks().some((track) => track.readyState === "live")) {
        const nextRecorder = startSegmentRecorder(stream, source);

        if (source === "microphone") {
          microphoneRecorderRef.current = nextRecorder;
        } else {
          systemRecorderRef.current = nextRecorder;
        }
      }
    };
    recorder.start();
    timerRef.current = window.setTimeout(() => {
      if (recorder.state === "recording") {
        recorder.stop();
      }
    }, RECORDING_SEGMENT_MS);

    return recorder;
  }

  async function transcribeChunk(blob: Blob, source: "microphone" | "system") {
    if (!sessionIdRef.current) {
      return;
    }

    try {
      const formData = new FormData();
      formData.append("audio", blob, "desktop-audio.webm");
      formData.append("mode", initialMode);
      formData.append(
        "prompt",
        buildTranscriptionPrompt(source, initialMode, transcriptRef.current)
      );
      formData.append("source", source);
      formData.append("tone", initialTone);
      formData.append("transcribeOnly", "true");
      const transcriptionLanguage = getTranscriptionLanguage(initialLanguage);

      if (transcriptionLanguage) {
        formData.append("language", transcriptionLanguage);
      }

      formData.append("outputLanguage", "english");

      pendingTranscriptionsRef.current += 1;
      setIsTranscribingAudio(true);

      const response = await fetch("/api/openai/transcribe-reply", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        error?: string;
        transcript?: string;
      };

      if (!response.ok || !data.transcript) {
        return;
      }

      const heardText = data.transcript?.trim() ?? "";
      const currentTranscript = transcriptRef.current;

      if (
        !heardText ||
        isLikelyDuplicateTranscript(currentTranscript, heardText)
      ) {
        return;
      }

      const speaker = source === "microphone" ? "user" : "other";
      const labelledText = `${speaker === "user" ? "You" : "Other"}: ${heardText}`;
      const nextTranscript = [currentTranscript, labelledText]
        .filter(Boolean)
        .join("\n");
      transcriptRef.current = nextTranscript;
      setTranscript(nextTranscript);
      void saveUserTurn(heardText, speaker);

      if (autoAnswerRef.current) {
        if (autoAnswerTimerRef.current) {
          window.clearTimeout(autoAnswerTimerRef.current);
        }

        autoAnswerTimerRef.current = window.setTimeout(() => {
          void generateReply(transcriptRef.current);
        }, AUTO_ANSWER_PAUSE_MS);
      }
    } catch {
      // Live audio keeps retrying on the next chunk.
    } finally {
      pendingTranscriptionsRef.current = Math.max(
        0,
        pendingTranscriptionsRef.current - 1
      );
      setIsTranscribingAudio(pendingTranscriptionsRef.current > 0);
      setLiveTranscriptPreview("");
    }
  }

  async function startMicrophoneCapture() {
    try {
      const selectedDeviceId = window.localStorage.getItem(AUDIO_DEVICE_STORAGE_KEY);
      const stream = await getMicrophoneStream(selectedDeviceId);
      microphoneStreamRef.current = stream;
      microphoneRecorderRef.current = startSegmentRecorder(stream, "microphone");
      speechRecognitionRef.current = startSpeechPreview(setLiveTranscriptPreview);
      setIsListening(true);
    } catch (error) {
      await window.kasaDesktop?.setOverlayMode?.("result");
      setReply(
        error instanceof Error
          ? `Microphone permission failed: ${error.message}`
          : "Microphone permission failed."
      );
    }
  }

  useEffect(() => {
    if (didAutoStartAudioRef.current) {
      return;
    }

    didAutoStartAudioRef.current = true;
    void Promise.allSettled([startMicrophoneCapture(), toggleSystemCapture()]);
    // Both sides should auto-start once per desktop session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function readStream(response: Response) {
    if (!response.body) {
      return "";
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let displayedLength = 0;
    let streamDone = false;
    let resolveReveal: (() => void) | null = null;
    const revealDone = new Promise<void>((resolve) => {
      resolveReveal = resolve;
    });

    revealTimerRef.current = window.setInterval(() => {
      if (displayedLength < fullText.length) {
        displayedLength = Math.min(displayedLength + 10, fullText.length);
        setReply(fullText.slice(0, displayedLength));
        return;
      }

      if (streamDone && revealTimerRef.current) {
        window.clearInterval(revealTimerRef.current);
        revealTimerRef.current = null;
        resolveReveal?.();
      }
    }, 14);

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      fullText += decoder.decode(value, { stream: true });
    }

    fullText += decoder.decode();
    streamDone = true;
    await revealDone;

    return fullText;
  }

  async function revealText(text: string) {
    let displayedLength = 0;

    setReply("");

    await new Promise<void>((resolve) => {
      revealTimerRef.current = window.setInterval(() => {
        displayedLength = Math.min(displayedLength + 10, text.length);
        setReply(text.slice(0, displayedLength));

        if (displayedLength >= text.length && revealTimerRef.current) {
          window.clearInterval(revealTimerRef.current);
          revealTimerRef.current = null;
          resolve();
        }
      }, 14);
    });
  }

  function pushReplyHistory(nextReply: string) {
    const cleanReply = nextReply.trim();

    if (!cleanReply) {
      return;
    }

    setReplyHistory((current) => {
      const baseHistory =
        replyHistoryIndex >= 0 ? current.slice(0, replyHistoryIndex + 1) : current;
      const lastReply = baseHistory.at(-1);

      if (lastReply === cleanReply) {
        setReplyHistoryIndex(baseHistory.length - 1);
        return baseHistory;
      }

      const nextHistory = [...baseHistory, cleanReply].slice(-20);

      setReplyHistoryIndex(nextHistory.length - 1);
      return nextHistory;
    });
  }

  function showReplyAt(index: number) {
    if (isGenerating) {
      return;
    }

    const nextReply = replyHistory[index];

    if (!nextReply) {
      return;
    }

    setReplyHistoryIndex(index);
    setReply(nextReply);
  }

  async function saveUserTurn(
    content: string,
    speaker: "other" | "user" = "other"
  ) {
    if (!sessionIdRef.current || !content.trim()) {
      return;
    }

    await fetch(`/api/sessions/${sessionIdRef.current}/turns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        speaker,
      }),
    });
  }

  async function saveAssistantTurn(content: string, model: string) {
    if (!sessionIdRef.current || !content.trim()) {
      return;
    }

    await fetch(`/api/sessions/${sessionIdRef.current}/turns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content,
        model,
        speaker: "assistant",
      }),
    });
  }

  async function copyReply() {
    await navigator.clipboard.writeText(reply);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  async function updateOpacity(nextOpacity: number) {
    setOpacity(nextOpacity);
    await window.kasaDesktop?.setOpacity?.(nextOpacity);
  }

  async function endSession() {
    stopLiveRecorder(
      microphoneRecorderRef.current,
      microphoneStreamRef.current,
      microphoneSegmentTimerRef
    );
    stopLiveRecorder(
      systemRecorderRef.current,
      systemStreamRef.current,
      systemSegmentTimerRef
    );
    stopStream(systemCaptureStreamRef.current);
    stopSpeechPreview(speechRecognitionRef.current);
    speechRecognitionRef.current = null;
    setIsListening(false);
    setIsSystemCapturing(false);
    setLiveTranscriptPreview("");

    if (sessionId) {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
      });
    }

    if (typeof window.kasaDesktop?.endOverlay === "function") {
      await window.kasaDesktop.endOverlay();
      return;
    }

    window.location.href = "/desktop";
  }

  async function collapseOverlay() {
    const didCollapse = await window.kasaDesktop?.collapseOverlay?.();

    if (didCollapse !== false) {
      setIsCollapsed(true);
    }
  }

  async function expandOverlay() {
    const didExpand = await window.kasaDesktop?.expandOverlay?.({
      mode: isGenerating || reply.trim()
        ? "result"
        : activeTool === "chat"
          ? "chat"
          : "compact",
    });

    if (didExpand !== false) {
      setIsCollapsed(false);
    }
  }

  const shouldShowResultPanel = isGenerating || Boolean(reply.trim());

  if (isCollapsed) {
    return (
      <main className="desktop-drag flex h-screen w-screen justify-center bg-transparent p-2">
        <button
          className="desktop-no-drag grid size-10 place-items-center rounded-2xl bg-blue-600 text-base font-black text-white shadow-2xl ring-1 ring-white/20 transition hover:bg-blue-500"
          onClick={() => void expandOverlay()}
          type="button"
        >
          K
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-transparent p-2 text-slate-100">
      <div
        className={`mx-auto max-w-[calc(100vw-16px)] space-y-2 ${
          shouldShowResultPanel ? "w-[764px]" : "w-[584px]"
        }`}
      >
        <DesktopOverlayToolbar
          activeTool={activeTool}
          autoAnswer={autoAnswer}
          durationLabel={durationLabel}
          isGenerating={isGenerating}
          isListening={isListening}
          isSystemCapturing={isSystemCapturing}
          onAnalyze={() => void analyzeScreen()}
          onAnswer={() => void generateReply()}
          onCollapse={() => void collapseOverlay()}
          onEnd={() => void endSession()}
          onModeChange={setActiveTool}
          onToggleAutoAnswer={() => setAutoAnswer((current) => !current)}
        />
        <DesktopTranscriptBar
          isListening={isListening || isSystemCapturing}
          isTranscribing={isTranscribingAudio}
          livePreview={liveTranscriptPreview}
          placeholder={getInputPlaceholder(activeTool)}
          transcript={transcript}
          onAnswer={() => {
            if (activeTool === "analyze") {
              void analyzeScreen();
              return;
            }

            void generateReply();
          }}
          onTranscriptChange={setTranscript}
        />
        {activeTool === "chat" ? (
          <DesktopChatBar
            disabled={isGenerating}
            value={chatText}
            onChange={setChatText}
            onClose={() => {
              setActiveTool("answer");
              setChatText("");
            }}
            onSend={() => void sendChatMessage()}
          />
        ) : null}
        {shouldShowResultPanel ? (
          <DesktopAnswerPanel
            canGoNext={
              !isGenerating &&
              replyHistoryIndex >= 0 &&
              replyHistoryIndex < replyHistory.length - 1
            }
            canGoPrevious={!isGenerating && replyHistoryIndex > 0}
            copied={copied}
            historyLabel={
              replyHistory.length > 0 && replyHistoryIndex >= 0
                ? `${replyHistoryIndex + 1}/${replyHistory.length}`
                : ""
            }
            isGenerating={isGenerating}
            opacity={opacity}
            reply={reply}
            onClear={() => {
              setReply("");
              void window.kasaDesktop?.setOverlayMode?.("compact");
            }}
            onCopy={() => void copyReply()}
            onNext={() => showReplyAt(replyHistoryIndex + 1)}
            onOpacityChange={(nextOpacity) => void updateOpacity(nextOpacity)}
            onPrevious={() => showReplyAt(replyHistoryIndex - 1)}
          />
        ) : null}
      </div>
    </main>
  );
}

function stopLiveRecorder(
  recorder: MediaRecorder | null,
  stream: MediaStream | null,
  timerRef: React.MutableRefObject<number | null>
) {
  if (timerRef.current) {
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  if (recorder && recorder.state !== "inactive") {
    recorder.stop();
  }

  stream?.getTracks().forEach((track) => track.stop());
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function startSpeechPreview(onPreview: (value: string) => void) {
  const SpeechRecognitionConstructor = (
    window as typeof window & {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    }
  ).SpeechRecognition ??
    (
      window as typeof window & {
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      }
    ).webkitSpeechRecognition;

  if (!SpeechRecognitionConstructor) {
    return null;
  }

  const recognition = new SpeechRecognitionConstructor();

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  recognition.onerror = () => onPreview("");
  recognition.onresult = (event) => {
    let preview = "";

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];

      if (!result?.isFinal) {
        preview += result?.[0]?.transcript ?? "";
      }
    }

    onPreview(toEnglishLatinText(preview));
  };
  recognition.onend = () => onPreview("");

  try {
    recognition.start();
    return recognition;
  } catch {
    return null;
  }
}

function stopSpeechPreview(recognition: SpeechRecognitionLike | null) {
  if (!recognition) {
    return;
  }

  recognition.onend = null;
  recognition.onerror = null;
  recognition.onresult = null;

  try {
    recognition.stop();
  } catch {
    // Speech preview is optional; recorder transcription keeps running.
  }
}

async function getSystemAudioStream(platform?: NodeJS.Platform) {
  if (platform === "win32" || platform === "darwin") {
    try {
      const captureStream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
        video: {
          frameRate: {
            ideal: 1,
            max: 1,
          },
          height: {
            ideal: 2,
          },
          width: {
            ideal: 2,
          },
        },
      } as DisplayMediaStreamOptions);
      const audioTracks = captureStream.getAudioTracks();

      if (audioTracks.length > 0) {
        captureStream.getVideoTracks().forEach((track) => track.stop());
        return {
          captureStream,
          isMicrophoneFallback: false,
          stream: new MediaStream(audioTracks),
        };
      }

      stopStream(captureStream);
      if (platform === "win32") {
        throw new Error(getSystemAudioHelpMessage(platform));
      }
    } catch (error) {
      if (platform === "win32") {
        throw error;
      }
      // On older macOS versions, fall through to a selected loopback input.
    }
  }

  const selectedDeviceId =
    window.localStorage.getItem(SYSTEM_AUDIO_DEVICE_STORAGE_KEY) ??
    (await findLikelyLoopbackDeviceId());

  if (!selectedDeviceId) {
    throw new Error(getSystemAudioHelpMessage(platform));
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: getSystemAudioConstraints(selectedDeviceId),
  });

  return {
    captureStream: null,
    isMicrophoneFallback: false,
    stream,
  };
}

function hasLiveAudioTracks(stream: MediaStream | null) {
  return (
    stream?.getAudioTracks().some((track) => track.readyState === "live") ??
    false
  );
}

async function findLikelyLoopbackDeviceId() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return null;
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const loopbackDevice = devices.find((device) => {
    const label = device.label.toLowerCase();

    return (
      device.kind === "audioinput" &&
      (label.includes("blackhole") ||
        label.includes("loopback") ||
        label.includes("soundflower") ||
        label.includes("vb-cable") ||
        label.includes("cable output") ||
        label.includes("system audio"))
    );
  });

  return loopbackDevice?.deviceId ?? null;
}

function getSystemAudioConstraints(deviceId: string): MediaTrackConstraints {
  return {
    autoGainControl: false,
    channelCount: 2,
    deviceId: { exact: deviceId },
    echoCancellation: false,
    noiseSuppression: false,
  };
}

async function getMicrophoneStream(deviceId: string | null) {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: getMicrophoneConstraints(deviceId),
    });
  } catch (error) {
    if (!deviceId) {
      throw error;
    }

    window.localStorage.removeItem(AUDIO_DEVICE_STORAGE_KEY);
    return navigator.mediaDevices.getUserMedia({
      audio: getMicrophoneConstraints(null),
    });
  }
}

function getMicrophoneConstraints(deviceId: string | null): MediaTrackConstraints {
  const constraints: MediaTrackConstraints = {
    autoGainControl: true,
    channelCount: 1,
    echoCancellation: false,
    noiseSuppression: false,
  };

  if (deviceId) {
    constraints.deviceId = { exact: deviceId };
  }

  return constraints;
}

function pickSupportedMimeType() {
  const supportedTypes = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];

  return supportedTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function getSystemAudioHelpMessage(platform?: NodeJS.Platform) {
  if (platform === "win32") {
    return "System audio stream did not include audio. Share the full screen and keep the meeting/browser audio playing, then try again.";
  }

  if (platform === "darwin") {
    return "macOS did not provide a live system-audio track. Allow Kasa Cue in Privacy & Security > Screen & System Audio Recording and restart it. On macOS 12 or older, use BlackHole/Loopback.";
  }

  return "System audio stream did not include audio. Use a loopback input device, or use speaker output so the mic can hear it.";
}

function isLikelyDuplicateTranscript(current: string, next: string) {
  const normalizedNext = normalizeTranscriptLine(next);

  if (
    !normalizedNext ||
    normalizedNext.split(" ").filter(Boolean).length < MIN_TRANSCRIPT_WORDS
  ) {
    return true;
  }

  const recentLines = current
    .split("\n")
    .slice(-8)
    .map((line) => normalizeTranscriptLine(line))
    .filter(Boolean);

  return recentLines.some((line) => {
    if (line === normalizedNext) {
      return true;
    }

    if (
      normalizedNext.length >= 16 &&
      (line.includes(normalizedNext) || normalizedNext.includes(line))
    ) {
      return true;
    }

    return transcriptSimilarity(line, normalizedNext) >= 0.82;
  });
}

function normalizeTranscriptLine(value: string) {
  return toEnglishLatinText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getInputPlaceholder(activeTool: "answer" | "analyze" | "chat") {
  if (activeTool === "analyze") {
    return "Ask what to analyze on screen, then press Enter.";
  }

  if (activeTool === "chat") {
    return "Waiting for speech...";
  }

  return "Waiting for speech... or type/paste interviewer question";
}

function transcriptSimilarity(left: string, right: string) {
  const leftWords = new Set(left.split(" ").filter(Boolean));
  const rightWords = new Set(right.split(" ").filter(Boolean));

  if (!leftWords.size || !rightWords.size) {
    return 0;
  }

  const sharedWords = [...leftWords].filter((word) => rightWords.has(word));

  return sharedWords.length / Math.max(leftWords.size, rightWords.size);
}

function buildTranscriptionPrompt(
  source: "microphone" | "system",
  mode: string,
  recentTranscript: string
) {
  const recentContext = recentTranscript
    .split("\n")
    .slice(-6)
    .join(" ")
    .slice(-1200);

  return [
    `Session mode: ${mode}.`,
    mode === "normal-talk"
      ? "This is a natural workplace conversation. Capture exactly what the other person means, including suggestions, approvals, requests, dates, purchases, invoices, reimbursements, and next actions."
      : "This is live interview, meeting, phone-call, or client conversation audio.",
    source === "system"
      ? "Audio source is system output from a meeting, browser, video, or headphones."
      : "Audio source is microphone input and may include room speech, speaker audio, or a phone call nearby.",
    "Your job is to capture what the human speaker intended to say, not a brittle word-for-word guess from noisy audio.",
    "If speech is broken, accented, fast, mixed Hindi-English, or slightly unclear, infer the most likely intended sentence from the surrounding conversation.",
    "Always return English words in Latin script only. Never use Urdu, Arabic, Hindi, Devanagari, or any non-Latin script.",
    "If the speaker uses Hindi, Urdu, or Hinglish, translate or transliterate it into natural English/Hinglish using Latin letters.",
    "Prefer a clear, natural sentence that preserves the speaker's meaning over a literal fragment with misheard words.",
    "Keep names, companies, technologies, numbers, salary amounts, dates, and code terms accurate when audible.",
    "Do not invent missing facts. If a specific name, number, or date is not audible, keep the rest of the sentence clear without making up that detail.",
    recentContext
      ? `Recent conversation context for continuity only: ${recentContext}`
      : "",
    "Return only newly audible speech from this audio chunk.",
    "If there is no clear new speech, return an empty transcript.",
    "Do not add explanations, labels, timestamps, repeated prior context, or punctuation-heavy formatting.",
  ]
    .filter(Boolean)
    .join("\n");
}

function getTranscriptionLanguage(language: string) {
  if (language === "hindi" || language === "hinglish") {
    return "hi";
  }

  return "";
}

function toEnglishLatinText(value: string) {
  return value
    .replace(/[\u0600-\u06ff]+/g, "")
    .replace(/[\u0750-\u077f]+/g, "")
    .replace(/[\u08a0-\u08ff]+/g, "")
    .replace(/[\u0900-\u097f]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
