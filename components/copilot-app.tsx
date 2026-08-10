"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AnswerPanel } from "@/components/workspace/answer-panel";
import {
  ChatComposer,
  type ChatIntent,
} from "@/components/workspace/chat-composer";
import { LiveTranscriptStrip } from "@/components/workspace/live-transcript-strip";
import { modeOptions } from "@/components/workspace/options";
import {
  MobileAnswerDock,
  SessionTopBar,
} from "@/components/workspace/session-top-bar";
import {
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
  const [autoAnswer, setAutoAnswer] = useState(false);
  const [listenStatus, setListenStatus] = useState("Start meeting audio");
  const [durationLabel, setDurationLabel] = useState("0:00");
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const continuousRecordingRef = useRef(false);
  const recordingSegmentTimerRef = useRef<number | null>(null);
  const audioTranscriptionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const awaitingNewUtteranceRef = useRef(true);
  const utteranceSilenceTimerRef = useRef<number | null>(null);
  const speechVisibleTextRef = useRef("");
  const recordingVisibleTextRef = useRef("");
  const recordingLastSpeechAtRef = useRef(0);
  const pendingSpeakerTurnRef = useRef<string[]>([]);
  const speechActivityVersionRef = useRef(0);
  const bufferedTurnsRef = useRef<BufferedSessionTurn[]>([]);
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

          if (
            isLikelyTranscriptionArtifact(line) ||
            recentLinesContainDuplicate(nextTranscript, line)
          ) {
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
            bufferedTurnsRef.current
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
          model: activeSession.model,
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
    bufferedTurnsRef.current.push({
      content,
      createdAt: new Date().toISOString(),
      model: turnModel,
      speaker,
    });
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

  async function refineTranscriptLine(rawText: string) {
    const response = await fetch("/api/openai/clean-transcript", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        context: [
          activeSession.title,
          activeSession.context,
          activeSession.instructions,
          getRecentTranscript(transcriptRef.current),
        ]
          .filter(Boolean)
          .join("\n"),
        language: activeSession.language,
        text: rawText,
      }),
    });
    const data = (await response.json()) as {
      error?: string;
      transcript?: string;
    };

    if (!response.ok || !data.transcript?.trim()) {
      throw new Error(data.error ?? "Transcript cleanup failed.");
    }

    return data.transcript.trim();
  }

  function finalizeRecognizedSpeech(
    rawText: string,
    activityVersion: number
  ) {
    if (
      isLikelyTranscriptionArtifact(rawText) ||
      recentLinesContainDuplicate(transcriptRef.current, rawText)
    ) {
      return;
    }

    const nextTranscript = [transcriptRef.current.trim(), rawText]
      .filter(Boolean)
      .join("\n");
    const transcriptLineIndex = nextTranscript.split("\n").length - 1;
    const pendingIndex = pendingSpeakerTurnRef.current.length;
    const bufferedTurn: BufferedSessionTurn = {
      content: rawText,
      createdAt: new Date().toISOString(),
      speaker: "other",
    };

    transcriptRef.current = nextTranscript;
    pendingSpeakerTurnRef.current.push(rawText);
    bufferedTurnsRef.current.push(bufferedTurn);
    setTranscript(nextTranscript);

    void refineTranscriptLine(rawText)
      .then((correctedText) => {
        if (!correctedText || correctedText === rawText) return;

        const transcriptLines = transcriptRef.current.split("\n");

        if (transcriptLines[transcriptLineIndex] === rawText) {
          transcriptLines[transcriptLineIndex] = correctedText;
          const correctedTranscript = transcriptLines.join("\n");
          transcriptRef.current = correctedTranscript;
          setTranscript(correctedTranscript);
        }
        if (pendingSpeakerTurnRef.current[pendingIndex] === rawText) {
          pendingSpeakerTurnRef.current[pendingIndex] = correctedText;
        }
        if (bufferedTurn.content === rawText) {
          bufferedTurn.content = correctedText;
        }
        setLiveTranscript((currentText) => {
          const normalizedCurrent = currentText.trim();

          if (normalizedCurrent === rawText) return correctedText;
          if (normalizedCurrent.endsWith(rawText)) {
            return `${normalizedCurrent.slice(0, -rawText.length)}${correctedText}`;
          }

          return currentText;
        });
      })
      .catch(() => undefined);

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
  }

  async function transcribeRecordedAudio(audio: Blob) {
    setWarning("");

    try {
      if (!(await hasAudibleSpeech(audio))) {
        setListenStatus("Listening to both sides");
        return;
      }

      setListenStatus("Transcribing");
      const formData = new FormData();
      formData.append(
        "audio",
        new File([audio], "meeting-audio.webm", {
          type: audio.type || "audio/webm",
        })
      );
      formData.append("mode", activeSession.mode);
      formData.append("transcribeOnly", "true");
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

      if (response.status === 422) {
        recordingVisibleTextRef.current = "";
        recordingLastSpeechAtRef.current = 0;
        setListenStatus("Listening to both sides");
        return;
      }

      if (!response.ok || !data.transcript?.trim()) {
        throw new Error(data.error ?? "No clear speech was found in this recording.");
      }

      const cleanText = data.transcript.trim();
      const spokenAt = Date.now();
      recentAudioSegmentsRef.current = recentAudioSegmentsRef.current.filter(
        (segment) => spokenAt - segment.time < 30000
      );

      if (
        isLikelyTranscriptionArtifact(cleanText) ||
        recentAudioSegmentsRef.current.some((segment) =>
          isNearDuplicateTranscript(cleanText, segment.text)
        ) ||
        recentLinesContainDuplicate(transcriptRef.current, cleanText)
      ) {
        setListenStatus("Listening to both sides");
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
        continuousRecordingRef.current
          ? "Listening to both sides"
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
      setListenStatus("Try recording again");
    } finally {
    }
  }

  async function startAudioRecording() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setListenStatus("Type mode");
      setWarning("Audio recording is not supported here. You can type or paste the meeting line below.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: true,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });
      continuousRecordingRef.current = true;
      beginRecordingStream(stream, "Listening to both sides");
      setError("");
      setWarning("");
    } catch (caughtError) {
      setIsListening(false);
      setListenStatus("Mic blocked");
      setError(
        caughtError instanceof Error && caughtError.name === "NotAllowedError"
          ? "Microphone access is blocked. Allow microphone permission in your browser settings and try again."
          : "The microphone could not start. Check that another app is not using it."
      );
    }
  }

  function beginRecordingStream(stream: MediaStream, status: string) {
    const preferredType = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
    ].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(
      stream,
      preferredType ? { mimeType: preferredType } : undefined
    );

    audioChunksRef.current = [];
    discardRecordingRef.current = false;
    mediaStreamRef.current = stream;
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const audio = new Blob(audioChunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      if (audio.size > 0 && !discardRecordingRef.current) {
        audioTranscriptionQueueRef.current = audioTranscriptionQueueRef.current
          .catch(() => undefined)
          .then(() => transcribeRecordedAudio(audio));
      }

      if (
        continuousRecordingRef.current &&
        !discardRecordingRef.current &&
        stream.getAudioTracks().some((track) => track.readyState === "live")
      ) {
        beginRecordingStream(stream, status);
        return;
      }

      stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setIsListening(false);
    };
    recorder.start();
    recordingSegmentTimerRef.current = window.setTimeout(() => {
      if (recorder.state === "recording") {
        recorder.stop();
      }
    }, 3500);
    setIsListening(true);
    setListenStatus(status);
  }

  async function startListening(allowRecorderFallback = false) {
    setError("");

    if (
      allowRecorderFallback &&
      window.matchMedia("(pointer: coarse)").matches
    ) {
      await startAudioRecording();
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
        speechVisibleTextRef.current = [
          speechVisibleTextRef.current,
          cleanFinalText,
        ]
          .filter(Boolean)
          .join(" ");
        finalizeRecognizedSpeech(cleanFinalText, activityVersion);

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
        }, 350);
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
    const startTimer = window.setTimeout(() => {
      void startListening(true);
    }, 0);

    return () => {
      window.clearTimeout(startTimer);
      shouldKeepListeningRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      discardRecordingRef.current = true;
      continuousRecordingRef.current = false;
      if (recordingSegmentTimerRef.current) {
        window.clearTimeout(recordingSegmentTimerRef.current);
      }
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
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
    shouldKeepListeningRef.current = false;
    continuousRecordingRef.current = false;
    if (recordingSegmentTimerRef.current) {
      window.clearTimeout(recordingSegmentTimerRef.current);
      recordingSegmentTimerRef.current = null;
    }
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    discardRecordingRef.current = true;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
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
          isListening={isListening}
          listenStatus={listenStatus}
          onAnswer={() => void generateReply()}
          onAutoAnswerChange={setAutoAnswer}
          onEnd={() => void endSession()}
        />

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
              transcript={transcript}
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
    .slice(-24)
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

  return history.length > 14000 ? history.slice(-14000) : history;
}

function recentLinesContainDuplicate(transcript: string, candidate: string) {
  return transcript
    .split("\n")
    .slice(-8)
    .some((line) => isNearDuplicateTranscript(candidate, line));
}

async function hasAudibleSpeech(audio: Blob) {
  let audioContext: AudioContext | null = null;

  try {
    audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(
      await audio.arrayBuffer()
    );
    let peak = 0;
    let energy = 0;
    let samples = 0;
    let activeSamples = 0;

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const data = audioBuffer.getChannelData(channel);
      const sampleStep = Math.max(1, Math.floor(data.length / 60000));

      for (let index = 0; index < data.length; index += sampleStep) {
        const amplitude = Math.abs(data[index]);
        peak = Math.max(peak, amplitude);
        energy += amplitude * amplitude;
        samples += 1;
        if (amplitude >= 0.012) activeSamples += 1;
      }
    }

    const rms = samples ? Math.sqrt(energy / samples) : 0;
    const activeRatio = samples ? activeSamples / samples : 0;

    return peak >= 0.018 && (rms >= 0.0025 || activeRatio >= 0.008);
  } catch {
    // Some browsers cannot decode their own MediaRecorder container. The
    // server-side artifact checks still protect the transcript in that case.
    return true;
  } finally {
    await audioContext?.close().catch(() => undefined);
  }
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
