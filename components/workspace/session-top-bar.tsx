"use client";

import {
  LogOut,
  Mic,
  Sparkles,
  Timer,
  WandSparkles,
} from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type SessionTopBarProps = {
  autoAnswer: boolean;
  canAnswer: boolean;
  durationLabel: string;
  isGenerating: boolean;
  isEnding: boolean;
  isListening: boolean;
  listeningActionLabel: string;
  listenStatus: string;
  floatingControl?: ReactNode;
  onAnswer: () => void;
  onAutoAnswerChange: (enabled: boolean) => void;
  onEnd: () => void;
  onListeningClick: () => void;
};

type MobileAnswerDockProps = Pick<
  SessionTopBarProps,
  "canAnswer" | "isGenerating" | "onAnswer"
>;

export function SessionTopBar({
  autoAnswer,
  canAnswer,
  durationLabel,
  isGenerating,
  isEnding,
  isListening,
  listeningActionLabel,
  listenStatus,
  floatingControl,
  onAnswer,
  onAutoAnswerChange,
  onEnd,
  onListeningClick,
}: SessionTopBarProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-6 sm:py-4">
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <Image
            alt="Kasa Cue"
            className="size-9 rounded-xl shadow-sm sm:size-10"
            height={40}
            priority
            src="/kasa-icon.png"
            width={40}
          />
          <button
            aria-label={`${isListening ? "Listening is ready" : listenStatus}. ${listeningActionLabel}`}
            aria-live="polite"
            className={`flex size-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold sm:h-10 sm:w-auto sm:justify-start sm:gap-2 sm:rounded-full sm:px-3 ${
              isListening
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-100 text-slate-700"
            }`}
            onClick={onListeningClick}
            role="status"
            title={`${listenStatus} · ${listeningActionLabel}`}
            type="button"
          >
            <Mic
              className={isListening ? "size-4 animate-pulse" : "size-4"}
            />
            <span className="hidden max-w-48 truncate sm:inline">
              {listenStatus}
            </span>
          </button>
        </div>

        <Badge className="h-10 gap-1.5 rounded-xl bg-slate-100 px-2.5 text-xs text-slate-900 hover:bg-slate-100 sm:gap-2 sm:rounded-md sm:px-4 sm:text-sm">
          <Timer className="size-3.5 sm:size-4" />
          {durationLabel}
        </Badge>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 sm:rounded-md sm:px-3">
            <Switch
              aria-label="Automatic answers"
              checked={autoAnswer}
              onCheckedChange={onAutoAnswerChange}
              size="sm"
            />
            <Label className="hidden text-sm font-semibold text-slate-800 sm:inline-flex">
              Auto
            </Label>
          </div>

          {floatingControl}

          <Button
            aria-label="End session"
            className="size-10 rounded-xl p-0 sm:h-10 sm:w-auto sm:min-w-32 sm:rounded-md sm:px-3"
            disabled={isEnding}
            onClick={onEnd}
            type="button"
            variant="outline"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">End session</span>
          </Button>

          <Button
            className="hidden h-10 min-w-32 gap-2 bg-slate-950 px-3 text-white hover:bg-slate-800 sm:inline-flex"
            disabled={isGenerating || !canAnswer}
            onClick={onAnswer}
            type="button"
          >
            {isGenerating ? (
              <Sparkles className="size-4 animate-pulse" />
            ) : (
              <WandSparkles className="size-4" />
            )}
            Answer
          </Button>
        </div>
      </div>
    </header>
  );
}

export function MobileAnswerDock({
  canAnswer,
  isGenerating,
  onAnswer,
}: MobileAnswerDockProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-slate-100 via-slate-100/90 to-transparent pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6 sm:hidden">
      <div className="pointer-events-auto flex size-[76px] items-center justify-center rounded-full border border-white/90 bg-white/70 shadow-[0_12px_32px_rgba(15,23,42,0.22)] backdrop-blur-md">
        <Button
          aria-label={isGenerating ? "Preparing answer" : "Generate answer"}
          className="size-16 rounded-full border border-slate-700 bg-slate-950 p-0 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_5px_14px_rgba(15,23,42,0.32)] transition active:scale-95 hover:bg-slate-800"
          disabled={isGenerating || !canAnswer}
          onClick={onAnswer}
          title={isGenerating ? "Preparing answer" : "Answer"}
          type="button"
        >
          {isGenerating ? (
            <Sparkles className="size-6 animate-pulse" />
          ) : (
            <WandSparkles className="size-6" />
          )}
          <span className="sr-only">
            {isGenerating ? "Preparing answer" : "Answer"}
          </span>
        </Button>
      </div>
    </div>
  );
}
