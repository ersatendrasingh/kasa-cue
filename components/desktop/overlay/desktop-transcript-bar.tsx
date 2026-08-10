"use client";

import { Mic, Radio } from "lucide-react";
import { useMemo, useRef } from "react";

type DesktopTranscriptBarProps = {
  isListening?: boolean;
  isTranscribing?: boolean;
  livePreview?: string;
  onAnswer: () => void;
  onTranscriptChange: (value: string) => void;
  placeholder?: string;
  transcript: string;
};

export function DesktopTranscriptBar({
  isListening = false,
  isTranscribing = false,
  livePreview = "",
  onAnswer,
  onTranscriptChange,
  placeholder = "Waiting for speech...",
  transcript,
}: DesktopTranscriptBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const latestTranscriptLine = useMemo(
    () => getLatestLine(transcript),
    [transcript]
  );
  const visibleValue = livePreview.trim() || latestTranscriptLine;
  const visiblePlaceholder = isTranscribing
    ? "Transcribing English..."
    : isListening
      ? "Listening..."
      : placeholder;
  const displayText = visibleValue || visiblePlaceholder;
  const shouldMarquee = Boolean(visibleValue) && displayText.length > 48;
  const marqueeDuration = `${Math.min(
    26,
    Math.max(10, Math.ceil(displayText.length / 8))
  )}s`;

  return (
    <label
      className="desktop-no-drag flex h-10 cursor-text items-center gap-2.5 overflow-hidden rounded-xl bg-slate-950/90 px-3 text-xs text-slate-200 shadow-xl ring-1 ring-white/10 backdrop-blur"
      onClick={() => inputRef.current?.focus()}
    >
      <Mic
        className={`size-3.5 shrink-0 ${
          isListening || isTranscribing ? "text-emerald-300" : "text-slate-500"
        }`}
      />
      <span
        aria-live="polite"
        className="transcript-marquee-mask relative block min-w-0 flex-1 overflow-hidden whitespace-nowrap"
      >
        {shouldMarquee ? (
          <span
            key={displayText}
            className="transcript-marquee-track inline-block w-max max-w-none font-medium text-slate-100"
            style={{ animationDuration: marqueeDuration }}
            title={displayText}
          >
            {displayText}
          </span>
        ) : (
          <span
            className={`block w-full truncate text-right font-medium ${
              visibleValue ? "text-slate-100" : "text-slate-500"
            }`}
            title={displayText}
          >
            {displayText}
          </span>
        )}
      </span>
      {isListening || isTranscribing ? (
        <Radio className="size-3.5 shrink-0 animate-pulse text-emerald-300" />
      ) : null}
      <input
        ref={inputRef}
        aria-label="Transcript"
        className="sr-only"
        value={transcript}
        onChange={(event) => onTranscriptChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onAnswer();
          }
        }}
      />
    </label>
  );
}

function getLatestLine(value: string) {
  return (
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1) ?? ""
  );
}
