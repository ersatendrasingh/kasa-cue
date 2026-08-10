"use client";

import { Mic } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { isLikelyTranscriptionArtifact } from "@/lib/transcript-safety";

type LiveTranscriptStripProps = {
  liveTranscript: string;
  transcript: string;
};

const EMPTY_TRANSCRIPT =
  "Listening for the conversation. The latest spoken words will appear here.";

export function LiveTranscriptStrip({
  liveTranscript,
  transcript,
}: LiveTranscriptStripProps) {
  const sourceText = useMemo(
    () => buildVisibleTranscript(transcript, liveTranscript),
    [liveTranscript, transcript]
  );
  const [displayedText, setDisplayedText] = useState("");
  const targetTextRef = useRef(sourceText);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    targetTextRef.current = sourceText;
  }, [sourceText]);

  useEffect(() => {
    const typingTimer = window.setInterval(() => {
      setDisplayedText((currentText) => {
        const targetText = targetTextRef.current;

        if (currentText === targetText) {
          return currentText;
        }

        if (targetText.startsWith(currentText)) {
          return targetText.slice(0, currentText.length + 1);
        }

        const sharedLength = getSharedPrefixLength(currentText, targetText);
        return targetText.slice(0, sharedLength + 1);
      });
    }, 16);

    return () => window.clearInterval(typingTimer);
  }, []);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;

    if (!scrollArea) {
      return;
    }

    scrollArea.scrollLeft = scrollArea.scrollWidth;
  }, [displayedText]);

  const hasSpeech = Boolean(sourceText);

  return (
    <section className="flex min-h-14 items-center overflow-hidden rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:gap-3 sm:rounded-md sm:px-5 sm:py-3">
      <div className="hidden shrink-0 items-center gap-3 sm:flex">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
          <Mic className="size-4" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Live transcript
          </p>
        </div>
      </div>

      <div
        aria-label="Live meeting transcript"
        aria-live="polite"
        className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden whitespace-nowrap text-left [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        ref={scrollAreaRef}
        role="log"
      >
        <span
          className={
            hasSpeech
              ? "inline-block text-[15px] leading-7 text-slate-900 sm:text-base"
              : "text-sm leading-6 text-slate-500"
          }
        >
          {hasSpeech ? (
            displayedText
          ) : (
            <>
              <span className="sm:hidden">Listening…</span>
              <span className="hidden sm:inline">{EMPTY_TRANSCRIPT}</span>
            </>
          )}
          {hasSpeech ? (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-5 w-0.5 translate-y-1 animate-pulse rounded-full bg-emerald-500"
            />
          ) : null}
        </span>
      </div>

      <span className="hidden shrink-0 items-center gap-1.5 text-xs font-medium text-emerald-700 sm:flex">
        <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
        Live
      </span>
    </section>
  );
}

function buildVisibleTranscript(transcript: string, liveTranscript: string) {
  const savedText = transcript.trim();
  const latestLiveText = isLikelyTranscriptionArtifact(liveTranscript)
    ? ""
    : liveTranscript.trim();
  const savedLastLine = getLastTranscriptLine(savedText);

  return (latestLiveText || savedLastLine || "")
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ");
}

function getLastTranscriptLine(transcript: string) {
  return transcript
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !isLikelyTranscriptionArtifact(line))
    .at(-1);
}

function getSharedPrefixLength(first: string, second: string) {
  const maxLength = Math.min(first.length, second.length);
  let index = 0;

  while (index < maxLength && first[index] === second[index]) {
    index += 1;
  }

  return index;
}
