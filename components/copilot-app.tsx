"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingOverlay } from "@/components/ui/loading-overlay";

import { AnswerPanel } from "@/components/workspace/answer-panel";
import {
  ChatComposer,
  type ChatIntent,
} from "@/components/workspace/chat-composer";
import { LiveTranscriptStrip } from "@/components/workspace/live-transcript-strip";
import { FloatingKasaWindow } from "@/components/workspace/floating-kasa-window";
import { modeOptions } from "@/components/workspace/options";
import {
  MobileAnswerDock,
  SessionTopBar,
} from "@/components/workspace/session-top-bar";
import {
  cleanSpeechDisfluencies,
  isLikelyTranscriptionArtifact,
  isNearDuplicateTranscript,
} from "@/lib/transcript-safety";
import type {
  ActiveWorkspaceSession,
  GenerateReplyResponse,
  KasaSpeechRecognition,
  SpeechWindow,
  WorkspaceUser,
} from "@/components/workspace/types";

type CopilotAppProps = {
  activeSession: ActiveWorkspaceSession;
  user: WorkspaceUser;
};

type BufferedSessionTurn = {
  content: string;
  createdAt: string;
  model?: string;
  speaker: "other" | "user" | "assistant";
};

type RepeatedQuestion = {
  count: number;
  text: string;
};

type NativeTranscriptDetail = {
  isFinal: boolean;
  text: string;
};

export default function CopilotApp({ activeSession }: CopilotAppProps) {
  const router = useRouter();
  const [transcript, setTranscript] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatIntent, setChatIntent] =
    useState<ChatIntent>("say-in-english");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [utteranceId, setUtteranceId] = useState(0);
  const [visibleReply, setVisibleReply] = useState(
    "Ready. Speak or type the latest meeting line, then press Answer."
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMeetingAudioCapturing, setIsMeetingAudioCapturing] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [autoAnswer, setAutoAnswer] = useState(false);
  const [listenStatus, setListenStatus] = useState("Start meeting audio");
  const [durationLabel, setDurationLabel] = useState("0:00");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [isNativeIOS, setIsNativeIOS] = useState(false);
  const [model, setModel] = useState(activeSession.model);
  const [copied, setCopied] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);
  const [answerIndex, setAnswerIndex] = useState(-1);
  const recognitionRef = useRef<KasaSpeechRecognition | null>(null);
  const shouldKeepListeningRef = useRef(false);
  const typingTimerRef = useRef<number | null>(null);
  const autoAnswerTimerRef = useRef<number | null>(null);
  const autoAnswerRef = useRef(false);
  const isGeneratingRef = useRef(false);
  const lastAutoAnsweredRef = useRef("");
  const transcriptRef = useRef("");
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const microphoneRecordersRef = useRef(new Set<MediaRecorder>());
  const microphoneTimersRef = useRef(new Set<number>());
  const microphoneActiveRef = useRef(false);
  const meetingAudioCaptureStreamRef = useRef<MediaStream | null>(null);
  const meetingAudioRecordersRef = useRef(new Set<MediaRecorder>());
  const meetingAudioTimersRef = useRef(new Set<number>());
  const meetingAudioActiveRef = useRef(false);
  const meetingAudioQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastMeetingAudioChunkTextRef = useRef("");
  const discardRecordingRef = useRef(false);
  const continuousRecordingRef = useRef(false);
  const isStartingAudioRef = useRef(false);
  const audioTranscriptionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastMicrophoneAudioChunkTextRef = useRef("");
  const awaitingNewUtteranceRef = useRef(true);
  const utteranceSilenceTimerRef = useRef<number | null>(null);
  const speechVisibleTextRef = useRef("");
  const recordingVisibleTextRef = useRef("");
  const recordingLastSpeechAtRef = useRef(0);
  const pendingSpeakerTurnRef = useRef<string[]>([]);
  const speechActivityVersionRef = useRef(0);
  const bufferedTurnsRef = useRef<BufferedSessionTurn[]>([]);
  const conversationTurnsRef = useRef<BufferedSessionTurn[]>([]);
  const unresolvedQuestionRef = useRef("");
  const repeatedQuestionRef = useRef<RepeatedQuestion | null>(null);
  const remoteTurnCursorRef = useRef(
    new Date(activeSession.startedAt).toISOString()
  );
  const remoteTurnIdsRef = useRef(new Set<string>());
  const remoteSyncInFlightRef = useRef(false);
  const remoteVisibleTextRef = useRef("");
  const remoteVisibleSpeakerRef = useRef("");
  const remoteLastSpeechAtRef = useRef(0);
  const recentAudioSegmentsRef = useRef<Array<{ text: string; time: number }>>(
    []
  );

  const activeMode = useMemo(
    () =>
      modeOptions.find((item) => item.value === activeSession.mode) ??
      modeOptions[0],
    [activeSession.mode]
  );

  useEffect(() => {
    const nativeDetectionTimer = window.setTimeout(() => {
      setIsNativeIOS(Boolean((window as SpeechWindow).__KASA_NATIVE_IOS__));
    }, 0);

    return () => window.clearTimeout(nativeDetectionTimer);
  }, []);

  useEffect(() => {
    const startedAt = new Date(activeSession.startedAt).getTime();

    function updateDuration() {
      const totalSeconds = Math.max(
        0,
        Math.floor((Date.now() - startedAt) / 1000)
      );
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      setDurationLabel(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    }

    updateDuration();
    const intervalId = window.setInterval(updateDuration, 1000);

    return () => window.clearInterval(intervalId);
  }, [activeSession.startedAt]);

  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  useEffect(() => {
    autoAnswerRef.current = autoAnswer;
  }, [autoAnswer]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    let active = true;

    async function syncLaptopTranscript() {
      if (remoteSyncInFlightRef.current || document.visibilityState === "hidden") {
        return;
      }

      remoteSyncInFlightRef.current = true;

      try {
        const response = await fetch(
          `/api/sessions/${activeSession.id}/turns?after=${encodeURIComponent(
            remoteTurnCursorRef.current
          )}`,
          { cache: "no-store" }
        );
        const data = (await response.json()) as {
          turns?: Array<{
            content: string;
            createdAt: string;
            id: string;
            speaker: string;
          }>;
        };

        if (!active || !response.ok || !data.turns?.length) {
          return;
        }

        let nextTranscript = transcriptRef.current;
        let latestRemoteLine = "";
        let startedNewVisibleTurn = false;

        for (const turn of data.turns) {
          remoteTurnCursorRef.current = turn.createdAt;

          if (
            !["other", "user"].includes(turn.speaker) ||
            remoteTurnIdsRef.current.has(turn.id) ||
            !turn.content.trim()
          ) {
            continue;
          }

          remoteTurnIdsRef.current.add(turn.id);
          const line = turn.content.trim();

          if (isLikelyTranscriptionArtifact(line)) {
            continue;
          }

          const repeatedLine = findRecentDuplicateLine(nextTranscript, line);

          if (repeatedLine) {
            if (turn.speaker === "other") {
              rememberRepeatedQuestion(line, repeatedLine);
            }
            continue;
          }

          const spokenAt = new Date(turn.createdAt).getTime();
          const startsNewTurn =
            !remoteVisibleTextRef.current ||
            remoteVisibleSpeakerRef.current !== turn.speaker ||
            spokenAt - remoteLastSpeechAtRef.current > 6500;
          const labelledLine = `${
            turn.speaker === "user" ? "You" : "Other"
          }: ${line}`;
          const recentLines = nextTranscript.split("\n").slice(-5);

          if (
            recentLines.some(
              (recentLine) => recentLine.trim() === labelledLine
            )
          ) {
            continue;
          }

          nextTranscript = [nextTranscript.trim(), labelledLine]
            .filter(Boolean)
            .join("\n");
          rememberConversationTurn({
            content: line,
            createdAt: turn.createdAt,
            speaker: turn.speaker === "user" ? "user" : "other",
          });
          if (turn.speaker === "other") {
            pendingSpeakerTurnRef.current.push(line);
          }
          if (startsNewTurn) {
            remoteVisibleTextRef.current = labelledLine;
            remoteVisibleSpeakerRef.current = turn.speaker;
            startedNewVisibleTurn = true;
          } else {
            remoteVisibleTextRef.current = `${remoteVisibleTextRef.current} ${line}`;
          }
          remoteLastSpeechAtRef.current = spokenAt;
          latestRemoteLine = remoteVisibleTextRef.current;
        }

        if (latestRemoteLine && nextTranscript !== transcriptRef.current) {
          transcriptRef.current = nextTranscript;
          setTranscript(nextTranscript);
          setLiveTranscript(latestRemoteLine);
          if (startedNewVisibleTurn) {
            setUtteranceId((current) => current + 1);
          }
          setListenStatus("Receiving laptop meeting");
          setWarning("");
        }
      } catch {
        // Keep polling; a temporary network failure should not stop the meeting.
      } finally {
        remoteSyncInFlightRef.current = false;
      }
    }

    void syncLaptopTranscript();
    const intervalId = window.setInterval(syncLaptopTranscript, 1000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [activeSession.id]);

  async function generateReply(
    sourceTranscript = transcript,
    options: { intent?: ChatIntent; language?: string } = {}
  ) {
    const normalizedTranscript = sourceTranscript.trim();
    const pendingSpeakerTurn = pendingSpeakerTurnRef.current
      .filter((line) => !isLikelyTranscriptionArtifact(line))
      .join(" ")
      .trim();
    const pendingSegmentCount = pendingSpeakerTurnRef.current.length;
    const repeatedQuestion = repeatedQuestionRef.current;
    const latestSpeakerTurn = pendingSpeakerTurn || unresolvedQuestionRef.current;
    const recentTranscript = getRecentTranscript(normalizedTranscript);
    const intent = options.intent ?? "live-reply";
    const isProactiveIntent = intent !== "live-reply";
    const promptTranscript = pendingSpeakerTurn
      ? isProactiveIntent
        ? `Current speaker context: ${pendingSpeakerTurn}\n${recentTranscript}`
        : `${recentTranscript}\nLatest continuous speaker turn: ${pendingSpeakerTurn}`
      : recentTranscript;

    if (!recentTranscript && !pendingSpeakerTurn) {
      setWarning("Waiting for spoken or typed text before answering.");
      return;
    }

    setError("");
    setWarning("");
    setModel(activeSession.model);
    if (typingTimerRef.current) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setVisibleReply(
      intent === "live-reply"
        ? "Preparing a clear reply…"
        : "Writing your English line…"
    );
    setIsGenerating(true);

    try {
      const response = await fetch("/api/openai/generate-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationHistory: buildLiveConversationHistory(
            conversationTurnsRef.current
          ),
          intent,
          language: options.language ?? activeSession.language,
          historyContext: [
            activeSession.instructions,
            activeSession.context,
            activeSession.historyContext,
          ]
            .filter(Boolean)
            .join("\n\n"),
          mode: activeSession.mode,
          meetingMemory: buildCurrentMeetingMemory({
            repeatedQuestion,
            turns: conversationTurnsRef.current,
            unresolvedQuestion: unresolvedQuestionRef.current,
          }),
          model: activeSession.model,
          latestSpeakerTurn,
          repeatedQuestion: repeatedQuestion?.text ?? "",
          responseLength: "adaptive",
          sessionId: activeSession.id,
          stream: true,
          tone: activeSession.tone ?? "adaptive-genuine",
          transcript: promptTranscript,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as GenerateReplyResponse;

        throw new Error(data.error ?? "Could not generate reply.");
      }

      const nextReply = await readStreamingReply(response);

      if (!nextReply.trim()) {
        throw new Error("No reply generated.");
      }

      setModel(response.headers.get("X-Model") ?? activeSession.model);
      setAnswers((current) => {
        const nextAnswers = [...current, nextReply];
        setAnswerIndex(nextAnswers.length - 1);
        return nextAnswers;
      });
      saveSessionTurn(
        "assistant",
        nextReply,
        response.headers.get("X-Model") ?? activeSession.model
      );
      if (!isProactiveIntent) {
        pendingSpeakerTurnRef.current =
          pendingSpeakerTurnRef.current.slice(pendingSegmentCount);
        unresolvedQuestionRef.current = "";
        repeatedQuestionRef.current = null;
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? getSafeErrorMessage(caughtError.message)
          : "Could not generate reply.";

      setError(message);
      setVisibleReply(`I could not generate a reliable answer yet. ${message}`);
    } finally {
      setIsGenerating(false);
    }
  }

  function saveSessionTurn(
    speaker: "other" | "user" | "assistant",
    content: string,
    turnModel?: string
  ) {
    const turn: BufferedSessionTurn = {
      content,
      createdAt: new Date().toISOString(),
      model: turnModel,
      speaker,
    };

    bufferedTurnsRef.current.push(turn);
    rememberConversationTurn(turn);
    return turn;
  }

  function rememberConversationTurn(turn: BufferedSessionTurn) {
    if (!turn.content.trim() || isLikelyTranscriptionArtifact(turn.content)) {
      return;
    }

    conversationTurnsRef.current.push(turn);
    conversationTurnsRef.current = conversationTurnsRef.current.slice(-160);

    if (turn.speaker === "other" && looksLikeQuestion(turn.content)) {
      unresolvedQuestionRef.current = turn.content.trim();
    }
  }

  function rememberRepeatedQuestion(candidate: string, matchingLine: string) {
    const cleanCandidate = stripTranscriptSpeakerLabel(candidate);
    const cleanMatch = stripTranscriptSpeakerLabel(matchingLine);
    const question = looksLikeQuestion(cleanCandidate)
      ? cleanCandidate
      : looksLikeQuestion(cleanMatch)
        ? cleanMatch
        : unresolvedQuestionRef.current;

    if (!question) return;

    unresolvedQuestionRef.current = question;
    repeatedQuestionRef.current = {
      count: (repeatedQuestionRef.current?.count ?? 1) + 1,
      text: question,
    };
  }

  async function flushBufferedTurns() {
    const turns = bufferedTurnsRef.current.slice();

    if (!turns.length) {
      return;
    }

    const response = await fetch(`/api/sessions/${activeSession.id}/turns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ turns }),
    });

    if (!response.ok) {
      throw new Error("Could not save the session discussion.");
    }

    bufferedTurnsRef.current = bufferedTurnsRef.current.slice(turns.length);
  }

  async function readStreamingReply(response: Response) {
    if (!response.body) {
      const data = (await response.json()) as GenerateReplyResponse;
      const nextReply = data.reply ?? "";

      setVisibleReply(nextReply);
      return nextReply;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let reply = "";
    let displayedLength = 0;
    let streamDone = false;
    let resolveReveal: (() => void) | null = null;
    const revealDone = new Promise<void>((resolve) => {
      resolveReveal = resolve;
    });

    typingTimerRef.current = window.setInterval(() => {
      if (displayedLength < reply.length) {
        displayedLength = Math.min(reply.length, displayedLength + 3);
        setVisibleReply(reply.slice(0, displayedLength));
        return;
      }

      if (streamDone && typingTimerRef.current) {
        window.clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
        resolveReveal?.();
      }
    }, 16);

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });

      if (!chunk) {
        continue;
      }

      reply += chunk;
    }

    const tail = decoder.decode();

    if (tail) {
      reply += tail;
    }

    streamDone = true;
    await revealDone;

    return reply;
  }

  async function sendChatMessage() {
    const message = chatInput.trim();

    if (!message || isGenerating) {
      return;
    }

    const nextTranscript = [
      transcript.trim(),
      `User (${chatIntent}): ${message}`,
    ]
      .filter(Boolean)
      .join("\n");

    setTranscript(nextTranscript);
    setChatInput("");
    saveSessionTurn("user", `[${getChatIntentLabel(chatIntent)}] ${message}`);
    await generateReply(nextTranscript, {
      intent: chatIntent,
      language: "english",
    });
  }

  function showAnswerAt(nextIndex: number) {
    const nextReply = answers[nextIndex];

    if (!nextReply) {
      return;
    }

    if (typingTimerRef.current) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    setAnswerIndex(nextIndex);
    setVisibleReply(nextReply);
  }

  function finalizeRecognizedSpeech(
    rawText: string,
    activityVersion: number
  ) {
    const cleanText = cleanSpeechDisfluencies(rawText);

    if (!cleanText || isLikelyTranscriptionArtifact(cleanText)) {
      return false;
    }

    const repeatedLine = findRecentDuplicateLine(
      transcriptRef.current,
      cleanText
    );

    if (repeatedLine) {
      rememberRepeatedQuestion(cleanText, repeatedLine);
      return false;
    }

    const nextTranscript = [transcriptRef.current.trim(), cleanText]
      .filter(Boolean)
      .join("\n");
    const bufferedTurn: BufferedSessionTurn = {
      content: cleanText,
      createdAt: new Date().toISOString(),
      speaker: "other",
    };

    transcriptRef.current = nextTranscript;
    pendingSpeakerTurnRef.current.push(cleanText);
    bufferedTurnsRef.current.push(bufferedTurn);
    rememberConversationTurn(bufferedTurn);
    setTranscript(nextTranscript);

    if (
      autoAnswerRef.current &&
      activityVersion === speechActivityVersionRef.current &&
      nextTranscript !== lastAutoAnsweredRef.current
    ) {
      if (autoAnswerTimerRef.current) {
        window.clearTimeout(autoAnswerTimerRef.current);
      }

      autoAnswerTimerRef.current = window.setTimeout(() => {
        if (
          isGeneratingRef.current ||
          activityVersion !== speechActivityVersionRef.current
        ) {
          return;
        }

        lastAutoAnsweredRef.current = nextTranscript;
        void generateReply(nextTranscript);
      }, 4600);
    }

    return true;
  }

  async function transcribeRecordedAudio(
    audio: Blob,
    source: "meeting" | "microphone" = "microphone",
    commitAfter: Promise<void> = Promise.resolve()
  ) {
    const activeListenStatus =
      source === "meeting" ? "Mic + meeting audio" : "Listening";
    setWarning("");

    try {
      const formData = new FormData();
      const transcriptionContext = [
        activeSession.title,
        activeSession.context,
        activeSession.instructions,
        getRecentTranscript(transcriptRef.current),
      ]
        .filter(Boolean)
        .join("\n")
        .slice(-3000);
      formData.append(
        "audio",
        new File([audio], "meeting-audio.webm", {
          type: audio.type || "audio/webm",
        })
      );
      formData.append("mode", activeSession.mode);
      formData.append("context", transcriptionContext);
      formData.append("prompt", transcriptionContext.slice(-800));
      formData.append("transcribeOnly", "true");
      formData.append("fast", "true");
      formData.append("outputLanguage", activeSession.language);
      formData.append(
        "language",
        activeSession.language === "hindi" ||
          activeSession.language === "hinglish"
          ? "hi"
          : activeSession.language === "english"
            ? "en"
            : ""
      );
      const response = await fetch("/api/openai/transcribe-reply", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        error?: string;
        transcript?: string;
      };

      // Audio chunks upload and transcribe concurrently, but are committed in
      // capture order. This removes the growing serial-network backlog that
      // used to make an older sentence appear several seconds late.
      await commitAfter.catch(() => undefined);

      if (response.status === 422) {
        recordingVisibleTextRef.current = "";
        recordingLastSpeechAtRef.current = 0;
        setListenStatus(activeListenStatus);
        return;
      }

      if (!response.ok || !data.transcript?.trim()) {
        throw new Error(data.error ?? "No clear speech was found in this recording.");
      }

      const rawCleanText = data.transcript.trim();
      const previousAudioChunk =
        source === "meeting"
          ? lastMeetingAudioChunkTextRef.current
          : lastMicrophoneAudioChunkTextRef.current;
      const cleanText = removeOverlappingAudioPrefix(
        previousAudioChunk,
        rawCleanText
      );

      if (source === "meeting") {
        lastMeetingAudioChunkTextRef.current = rawCleanText;
      } else {
        lastMicrophoneAudioChunkTextRef.current = rawCleanText;
      }

      if (!cleanText) {
        setListenStatus(activeListenStatus);
        return;
      }
      const spokenAt = Date.now();
      recentAudioSegmentsRef.current = recentAudioSegmentsRef.current.filter(
        (segment) => spokenAt - segment.time < 30000
      );

      if (isLikelyTranscriptionArtifact(cleanText)) {
        setListenStatus(activeListenStatus);
        return;
      }

      const repeatedAudioLine = recentAudioSegmentsRef.current.find((segment) =>
        isNearDuplicateTranscript(cleanText, segment.text)
      )?.text;
      const repeatedTranscriptLine = findRecentDuplicateLine(
        transcriptRef.current,
        cleanText
      );

      if (repeatedAudioLine || repeatedTranscriptLine) {
        rememberRepeatedQuestion(
          cleanText,
          repeatedTranscriptLine ?? repeatedAudioLine ?? cleanText
        );
        setListenStatus(activeListenStatus);
        return;
      }

      recentAudioSegmentsRef.current.push({ text: cleanText, time: spokenAt });
      const startsNewVisibleTurn =
        !recordingVisibleTextRef.current ||
        spokenAt - recordingLastSpeechAtRef.current > 7000;
      const nextTranscript = [transcriptRef.current.trim(), cleanText]
        .filter(Boolean)
        .join("\n");
      transcriptRef.current = nextTranscript;
      pendingSpeakerTurnRef.current.push(cleanText);
      recordingVisibleTextRef.current = startsNewVisibleTurn
        ? cleanText
        : `${recordingVisibleTextRef.current} ${cleanText}`;
      recordingLastSpeechAtRef.current = spokenAt;
      if (startsNewVisibleTurn) {
        setUtteranceId((current) => current + 1);
      }
      setTranscript(nextTranscript);
      setLiveTranscript(recordingVisibleTextRef.current);
      saveSessionTurn("other", cleanText);
      setListenStatus(
        source === "meeting"
          ? "Mic + meeting audio"
          : continuousRecordingRef.current
          ? "Listening"
          : "Ready to record"
      );

      if (autoAnswerRef.current) {
        if (autoAnswerTimerRef.current) {
          window.clearTimeout(autoAnswerTimerRef.current);
        }
        autoAnswerTimerRef.current = window.setTimeout(() => {
          if (isGeneratingRef.current) return;
          const latestTranscript = transcriptRef.current;
          lastAutoAnsweredRef.current = latestTranscript;
          void generateReply(latestTranscript);
        }, 4600);
      }
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The recording could not be transcribed."
      );
      setListenStatus(
        source === "meeting" ? "Mic + meeting audio" : "Try recording again"
      );
    } finally {
    }
  }

  async function startAudioRecording() {
    if (
      mediaStreamRef.current
        ?.getAudioTracks()
        .some((track) => track.readyState === "live")
    ) {
      setIsListening(true);
      setListenStatus("Listening");
      setError("");
      setWarning("");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setListenStatus("Type mode");
      setWarning("Audio recording is not supported here. You can type or paste the meeting line below.");
      return;
    }

    if (isStartingAudioRef.current) return;
    isStartingAudioRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      continuousRecordingRef.current = true;
      microphoneActiveRef.current = true;
      discardRecordingRef.current = false;
      mediaStreamRef.current = stream;
      lastMicrophoneAudioChunkTextRef.current = "";
      beginRecordingStream(stream, "Listening");
      setError("");
      setWarning("");
    } catch (caughtError) {
      setIsListening(false);
      setListenStatus("Mic blocked");
      setError(
        caughtError instanceof Error && caughtError.name === "NotAllowedError"
          ? Boolean((window as SpeechWindow).__KASA_NATIVE_IOS__)
            ? "Microphone access is blocked. Open iPhone Settings → Kasa and enable Microphone, then return and tap the mic."
            : "Microphone access is blocked. Allow microphone permission in your browser settings and try again."
          : "The microphone could not start. Check that another app is not using it."
      );
    } finally {
      isStartingAudioRef.current = false;
    }
  }

  async function startMeetingAudioCapture() {
    if (isMeetingAudioCapturing) return;

    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) {
      setWarning(
        "This browser cannot capture meeting audio. Use the latest Chrome or the Kasa Cue desktop app."
      );
      return;
    }

    setError("");
    setWarning("");

    try {
      const captureStream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
        video: {
          frameRate: { ideal: 1, max: 1 },
          height: { ideal: 2 },
          width: { ideal: 2 },
        },
      } as DisplayMediaStreamOptions);
      const audioTracks = captureStream.getAudioTracks();

      if (!audioTracks.length) {
        captureStream.getTracks().forEach((track) => track.stop());
        throw new Error(
          "No meeting audio was shared. Choose the meeting tab/window and enable Share audio in the browser dialog."
        );
      }

      meetingAudioCaptureStreamRef.current = captureStream;
      meetingAudioActiveRef.current = true;
      lastMeetingAudioChunkTextRef.current = "";
      captureStream.getVideoTracks().forEach((track) => track.stop());
      const audioStream = new MediaStream(audioTracks);
      const audioTrack = audioTracks[0];

      audioTrack.addEventListener(
        "ended",
        () => {
          stopMeetingAudioCapture();
        },
        { once: true }
      );
      beginMeetingAudioRecording(audioStream);
      setIsMeetingAudioCapturing(true);
      setListenStatus("Mic + meeting audio");
    } catch (caughtError) {
      const errorName = caughtError instanceof Error ? caughtError.name : "";

      meetingAudioActiveRef.current = false;
      meetingAudioCaptureStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());
      meetingAudioCaptureStreamRef.current = null;

      if (errorName === "NotAllowedError") {
        setWarning(
          "Meeting audio was not connected. Tap the listening icon again and allow the meeting tab/window with Share audio enabled."
        );
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Meeting audio could not be connected."
      );
    }
  }

  function beginMeetingAudioRecording(stream: MediaStream) {
    if (
      !meetingAudioActiveRef.current ||
      !stream.getAudioTracks().some((track) => track.readyState === "live")
    ) {
      return;
    }

    const preferredType = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(
      stream,
      preferredType ? { mimeType: preferredType } : undefined
    );
    const chunks: Blob[] = [];

    meetingAudioRecordersRef.current.add(recorder);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const audio = new Blob(chunks, {
        type: recorder.mimeType || "audio/webm",
      });
      meetingAudioRecordersRef.current.delete(recorder);

      if (audio.size > 1000) {
        const previousCommit = meetingAudioQueueRef.current;
        meetingAudioQueueRef.current = transcribeRecordedAudio(
          audio,
          "meeting",
          previousCommit
        );
      }
    };
    recorder.start();

    let nextSegmentTimer = 0;
    nextSegmentTimer = window.setTimeout(() => {
      meetingAudioTimersRef.current.delete(nextSegmentTimer);
      beginMeetingAudioRecording(stream);
    }, 1500);
    meetingAudioTimersRef.current.add(nextSegmentTimer);

    let stopSegmentTimer = 0;
    stopSegmentTimer = window.setTimeout(() => {
      meetingAudioTimersRef.current.delete(stopSegmentTimer);
      if (recorder.state === "recording") recorder.stop();
    }, 2200);
    meetingAudioTimersRef.current.add(stopSegmentTimer);
  }

  function stopMeetingAudioCapture() {
    meetingAudioActiveRef.current = false;
    meetingAudioTimersRef.current.forEach((timer) =>
      window.clearTimeout(timer)
    );
    meetingAudioTimersRef.current.clear();
    meetingAudioRecordersRef.current.forEach((recorder) => {
      if (recorder.state === "recording") recorder.stop();
    });
    meetingAudioRecordersRef.current.clear();
    meetingAudioCaptureStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());
    meetingAudioCaptureStreamRef.current = null;
    lastMeetingAudioChunkTextRef.current = "";
    setIsMeetingAudioCapturing(false);
    setListenStatus(isListening ? "Listening" : "Start meeting audio");
  }

  function beginRecordingStream(stream: MediaStream, status: string) {
    if (
      !microphoneActiveRef.current ||
      !stream.getAudioTracks().some((track) => track.readyState === "live")
    ) {
      return;
    }

    const preferredType = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
    ].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(
      stream,
      preferredType ? { mimeType: preferredType } : undefined
    );

    const chunks: Blob[] = [];
    microphoneRecordersRef.current.add(recorder);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const audio = new Blob(chunks, {
        type: recorder.mimeType || "audio/webm",
      });
      microphoneRecordersRef.current.delete(recorder);
      if (audio.size > 1000 && !discardRecordingRef.current) {
        const previousCommit = audioTranscriptionQueueRef.current;
        audioTranscriptionQueueRef.current = transcribeRecordedAudio(
          audio,
          "microphone",
          previousCommit
        );
      }
    };
    recorder.start();

    let nextSegmentTimer = 0;
    nextSegmentTimer = window.setTimeout(() => {
      microphoneTimersRef.current.delete(nextSegmentTimer);
      beginRecordingStream(stream, status);
    }, 2200);
    microphoneTimersRef.current.add(nextSegmentTimer);

    let stopSegmentTimer = 0;
    stopSegmentTimer = window.setTimeout(() => {
      microphoneTimersRef.current.delete(stopSegmentTimer);
      if (recorder.state === "recording") {
        recorder.stop();
      }
    }, 3200);
    microphoneTimersRef.current.add(stopSegmentTimer);
    setIsListening(true);
    setListenStatus(status);
  }

  function stopMicrophoneCapture() {
    microphoneActiveRef.current = false;
    continuousRecordingRef.current = false;
    microphoneTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    microphoneTimersRef.current.clear();
    microphoneRecordersRef.current.forEach((recorder) => {
      if (recorder.state === "recording") recorder.stop();
    });
    microphoneRecordersRef.current.clear();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    lastMicrophoneAudioChunkTextRef.current = "";
    setIsListening(false);
  }

  async function startListening(allowRecorderFallback = false) {
    setError("");

    if (Boolean((window as SpeechWindow).__KASA_NATIVE_IOS__)) {
      (window as SpeechWindow).webkit?.messageHandlers?.kasaNative?.postMessage({
        action: "startTranscription",
        language: activeSession.language,
      });
      setIsListening(true);
      setListenStatus("Listening");
      setWarning("");
      return;
    }

    const SpeechRecognition =
      (window as SpeechWindow).SpeechRecognition ??
      (window as SpeechWindow).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      if (allowRecorderFallback) {
        await startAudioRecording();
      } else {
        setListenStatus("Tap mic to record");
      }
      return;
    }

    shouldKeepListeningRef.current = false;
    recognitionRef.current?.stop();
    shouldKeepListeningRef.current = true;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang =
      activeSession.language === "hindi" ||
      activeSession.language === "hinglish"
        ? "hi-IN"
        : navigator.language.startsWith("en")
          ? navigator.language
          : "en-US";

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const spokenText = result[0].transcript.trim();

        if (result.isFinal) {
          finalText += `${spokenText} `;
        } else {
          interimText += `${spokenText} `;
        }
      }

      if (finalText.trim() || interimText.trim()) {
        speechActivityVersionRef.current += 1;
        if (autoAnswerTimerRef.current) {
          window.clearTimeout(autoAnswerTimerRef.current);
          autoAnswerTimerRef.current = null;
        }
      }

      if (
        awaitingNewUtteranceRef.current &&
        (finalText.trim() || interimText.trim())
      ) {
        awaitingNewUtteranceRef.current = false;
        speechVisibleTextRef.current = "";
        setUtteranceId((current) => current + 1);
      }

      if (finalText.trim()) {
        const cleanFinalText = finalText.trim();
        const activityVersion = speechActivityVersionRef.current;
        const accepted = finalizeRecognizedSpeech(
          cleanFinalText,
          activityVersion
        );

        if (accepted) {
          speechVisibleTextRef.current = [
            speechVisibleTextRef.current,
            cleanSpeechDisfluencies(cleanFinalText),
          ]
            .filter(Boolean)
            .join(" ");
        }

        if (utteranceSilenceTimerRef.current) {
          window.clearTimeout(utteranceSilenceTimerRef.current);
        }
        utteranceSilenceTimerRef.current = window.setTimeout(() => {
          awaitingNewUtteranceRef.current = true;
          speechVisibleTextRef.current = "";
        }, 4200);
      }

      setLiveTranscript(
        [speechVisibleTextRef.current, interimText.trim()]
          .filter(Boolean)
          .join(" ")
      );
    };

    recognition.onerror = (event) => {
      if (
        event.error === "not-allowed" ||
        event.error === "service-not-allowed"
      ) {
        shouldKeepListeningRef.current = false;
        setError(
          "Microphone permission is blocked. Allow microphone access, or type the conversation manually."
        );
        setIsListening(false);
        setListenStatus("Mic blocked");
        return;
      }

      setListenStatus("Reconnecting");
    };

    recognition.onend = () => {
      if (shouldKeepListeningRef.current) {
        window.setTimeout(() => {
          try {
            recognition.start();
            setIsListening(true);
            setListenStatus("Listening");
          } catch {
            setListenStatus("Reconnecting");
          }
        }, 80);
        return;
      }

      setIsListening(false);
      setListenStatus("Type mode");
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
      setListenStatus("Listening");
    } catch {
      if (allowRecorderFallback) {
        await startAudioRecording();
      } else {
        setListenStatus("Tap mic to start");
      }
    }
  }

  useEffect(() => {
    function handleNativeMicrophoneGranted() {
      void startListening(true);
    }

    function handleNativeTranscript(event: Event) {
      const { detail } = event as CustomEvent<NativeTranscriptDetail>;
      const spokenText = detail?.text?.trim();

      if (!spokenText) return;

      speechActivityVersionRef.current += 1;
      const activityVersion = speechActivityVersionRef.current;
      if (autoAnswerTimerRef.current) {
        window.clearTimeout(autoAnswerTimerRef.current);
        autoAnswerTimerRef.current = null;
      }

      if (awaitingNewUtteranceRef.current) {
        awaitingNewUtteranceRef.current = false;
        setUtteranceId((current) => current + 1);
      }

      setIsListening(true);
      setListenStatus("Listening");
      setError("");
      setLiveTranscript(spokenText);

      if (!detail.isFinal) return;

      const accepted = finalizeRecognizedSpeech(spokenText, activityVersion);
      if (accepted) {
        setLiveTranscript(cleanSpeechDisfluencies(spokenText));
      }
      if (utteranceSilenceTimerRef.current) {
        window.clearTimeout(utteranceSilenceTimerRef.current);
      }
      utteranceSilenceTimerRef.current = window.setTimeout(() => {
        awaitingNewUtteranceRef.current = true;
      }, 700);
    }

    window.addEventListener(
      "kasa:microphone-granted",
      handleNativeMicrophoneGranted
    );
    window.addEventListener(
      "kasa:native-transcript",
      handleNativeTranscript
    );
    const startTimer = window.setTimeout(() => {
      void startListening(true);
    }, 0);

    return () => {
      window.removeEventListener(
        "kasa:microphone-granted",
        handleNativeMicrophoneGranted
      );
      window.removeEventListener(
        "kasa:native-transcript",
        handleNativeTranscript
      );
      (window as SpeechWindow).webkit?.messageHandlers?.kasaNative?.postMessage({
        action: "stopTranscription",
      });
      window.clearTimeout(startTimer);
      shouldKeepListeningRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      discardRecordingRef.current = true;
      stopMicrophoneCapture();
      stopMeetingAudioCapture();
      if (typingTimerRef.current) {
        window.clearInterval(typingTimerRef.current);
      }
      if (autoAnswerTimerRef.current) {
        window.clearTimeout(autoAnswerTimerRef.current);
      }
      if (utteranceSilenceTimerRef.current) {
        window.clearTimeout(utteranceSilenceTimerRef.current);
      }
    };
    // Start local speech input once; laptop system audio arrives through the
    // same-session bridge and is merged into this transcript.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function saveBeforeLeaving() {
      const turns = bufferedTurnsRef.current;

      if (!turns.length) return;

      navigator.sendBeacon(
        `/api/sessions/${activeSession.id}/turns`,
        new Blob([JSON.stringify({ turns })], {
          type: "application/json",
        })
      );
    }

    window.addEventListener("pagehide", saveBeforeLeaving);
    return () => window.removeEventListener("pagehide", saveBeforeLeaving);
  }, [activeSession.id]);

  async function endSession() {
    if (isEnding) return;
    setIsEnding(true);
    shouldKeepListeningRef.current = false;
    (window as SpeechWindow).webkit?.messageHandlers?.kasaNative?.postMessage({
      action: "stopTranscription",
    });
    discardRecordingRef.current = true;
    stopMicrophoneCapture();
    stopMeetingAudioCapture();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setListenStatus("Saving session");

    await Promise.allSettled([
      flushBufferedTurns(),
      fetch(`/api/sessions/${activeSession.id}`, {
        method: "PATCH",
      }),
    ]);
    router.push("/dashboard");
    router.refresh();
  }

  async function copyReply() {
    await navigator.clipboard.writeText(visibleReply);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-slate-100 text-slate-950">
      <section className="flex h-[100dvh] min-w-0 flex-col overflow-hidden">
        <SessionTopBar
          autoAnswer={autoAnswer}
          canAnswer={Boolean(getRecentTranscript(transcript))}
          durationLabel={durationLabel}
          isGenerating={isGenerating}
          isEnding={isEnding}
          isListening={isListening || isMeetingAudioCapturing}
          listeningActionLabel={
            isNativeIOS ? "Start microphone" : "Connect meeting audio"
          }
          listenStatus={
            isMeetingAudioCapturing ? "Mic + meeting audio" : listenStatus
          }
          floatingControl={
            !isNativeIOS ? (
              <FloatingKasaWindow
                canAnswer={Boolean(getRecentTranscript(transcript))}
                isGenerating={isGenerating}
                isListening={isListening || isMeetingAudioCapturing}
                liveTranscript={liveTranscript}
                visibleReply={visibleReply}
                onAnswer={() => void generateReply()}
              />
            ) : undefined
          }
          onAnswer={() => void generateReply()}
          onAutoAnswerChange={setAutoAnswer}
          onEnd={() => void endSession()}
          onListeningClick={() =>
            void (isNativeIOS
              ? startListening(true)
              : startMeetingAudioCapture())
          }
        />

        {isEnding ? (
          <LoadingOverlay
            description="Saving the conversation and meeting context."
            label="Ending your session"
          />
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 py-2.5 pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:p-4">
          <div className="flex min-h-full w-full flex-col gap-2.5 sm:gap-4">
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            {warning ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {warning}
              </div>
            ) : null}

            <LiveTranscriptStrip
              key={utteranceId}
              liveTranscript={liveTranscript}
            />

            <AnswerPanel
              activeMode={activeMode}
              answerIndex={answerIndex}
              answersLength={answers.length}
              copied={copied}
              isGenerating={isGenerating}
              model={model}
              visibleReply={visibleReply}
              onCopy={() => void copyReply()}
              onNext={() => showAnswerAt(answerIndex + 1)}
              onPrevious={() => showAnswerAt(answerIndex - 1)}
            />

            <ChatComposer
              disabled={isGenerating}
              intent={chatIntent}
              value={chatInput}
              onChange={setChatInput}
              onIntentChange={setChatIntent}
              onSend={() => void sendChatMessage()}
            />
          </div>
        </div>

        <MobileAnswerDock
          canAnswer={Boolean(getRecentTranscript(transcript))}
          isGenerating={isGenerating}
          onAnswer={() => void generateReply()}
        />
      </section>
    </main>
  );
}

function getChatIntentLabel(intent: ChatIntent) {
  if (intent === "ask-question") return "Ask a question";
  if (intent === "standup-update") return "Standup update";
  if (intent === "live-reply") return "Reply to speaker";
  return "Say in English";
}

function getRecentTranscript(transcript: string) {
  const recentLines = transcript
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !isLikelyTranscriptionArtifact(line))
    .slice(-32)
    .join("\n");

  return recentLines.length > 10000 ? recentLines.slice(-10000) : recentLines;
}

function buildLiveConversationHistory(turns: BufferedSessionTurn[]) {
  const history = turns
    .slice(-64)
    .map((turn) => {
      const speaker =
        turn.speaker === "assistant"
          ? "Previous Kasa answer"
          : turn.speaker === "other"
            ? "Other speaker"
            : "User";

      return `${speaker}: ${turn.content.trim().slice(0, 1800)}`;
    })
    .filter((line) => !isLikelyTranscriptionArtifact(line))
    .join("\n\n");

  return history.length > 20000 ? history.slice(-20000) : history;
}

function findRecentDuplicateLine(transcript: string, candidate: string) {
  return transcript
    .split("\n")
    .slice(-12)
    .find((line) => isNearDuplicateTranscript(candidate, line));
}

function buildCurrentMeetingMemory({
  repeatedQuestion,
  turns,
  unresolvedQuestion,
}: {
  repeatedQuestion: RepeatedQuestion | null;
  turns: BufferedSessionTurn[];
  unresolvedQuestion: string;
}) {
  const spokenTurns = turns.filter((turn) => turn.speaker !== "assistant");
  const importantPoints = spokenTurns
    .filter((turn) =>
      /\b(decid|agree|action|owner|deadline|today|tomorrow|yesterday|block|risk|issue|task|follow[ -]?up|need|must|should|will|plan|require)/i.test(
        turn.content
      )
    )
    .slice(-16)
    .map((turn) => `- ${compactMemoryLine(turn.content, 420)}`);
  const recentQuestions = spokenTurns
    .filter((turn) => looksLikeQuestion(turn.content))
    .slice(-8)
    .map((turn) => `- ${compactMemoryLine(turn.content, 500)}`);

  return [
    "Current meeting working memory:",
    "Treat pause-separated speech as one connected discussion. Resolve pronouns and short follow-ups from this memory before answering.",
    unresolvedQuestion
      ? `Open question to answer: ${compactMemoryLine(unresolvedQuestion, 900)}`
      : "",
    repeatedQuestion
      ? `Repeated unresolved question (${repeatedQuestion.count} times): ${compactMemoryLine(repeatedQuestion.text, 900)}`
      : "",
    importantPoints.length
      ? `Decisions, tasks, blockers, and commitments mentioned:\n${importantPoints.join("\n")}`
      : "",
    recentQuestions.length
      ? `Recent question trail:\n${recentQuestions.join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 9000);
}

function looksLikeQuestion(value: string) {
  const text = stripTranscriptSpeakerLabel(value).toLowerCase().trim();

  return (
    text.includes("?") ||
    /^(what|why|how|when|where|who|which|can|could|would|will|do|does|did|are|is|should|tell me|explain)\b/.test(
      text
    ) ||
    /\b(can you|could you|would you|do you|what do you|how do you|any thoughts|your thoughts|your view|what about|right)\s*[?.!]*$/.test(
      text
    )
  );
}

function stripTranscriptSpeakerLabel(value: string) {
  return value
    .replace(
      /^(user(?:\s*\([^)]*\))?|you|other|interviewer|candidate):\s*/i,
      ""
    )
    .trim();
}

function compactMemoryLine(value: string, maxLength: number) {
  return stripTranscriptSpeakerLabel(value)
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function removeOverlappingAudioPrefix(previousChunk: string, nextChunk: string) {
  if (!previousChunk.trim() || !nextChunk.trim()) return nextChunk.trim();

  const previousWords = previousChunk.trim().split(/\s+/);
  const nextWords = nextChunk.trim().split(/\s+/);
  const maxOverlap = Math.min(16, previousWords.length, nextWords.length);

  for (let size = maxOverlap; size >= 1; size -= 1) {
    const previousTail = previousWords
      .slice(-size)
      .map(normalizeAudioWord);
    const nextHead = nextWords.slice(0, size).map(normalizeAudioWord);
    const isUsefulSingleWord =
      size > 1 || (previousTail[0]?.length ?? 0) >= 5;

    if (
      isUsefulSingleWord &&
      previousTail.every((word, index) => word && word === nextHead[index])
    ) {
      return nextWords.slice(size).join(" ").trim();
    }
  }

  return nextChunk.trim();
}

function normalizeAudioWord(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9'-]/g, "");
}

function getSafeErrorMessage(message: string) {
  if (
    message.length > 240 ||
    /prisma|invocation|unknown field|database|stack|select statement/i.test(
      message
    )
  ) {
    return "Could not generate a reply right now. Please try again.";
  }

  return message;
}
