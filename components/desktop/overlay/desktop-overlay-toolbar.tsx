"use client";

import {
  ChevronUp,
  LogOut,
  MessageSquare,
  AudioLines,
  ScanLine,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type DesktopOverlayToolbarProps = {
  activeTool: "answer" | "analyze" | "chat";
  autoAnswer: boolean;
  durationLabel: string;
  isGenerating: boolean;
  isListening: boolean;
  isSystemCapturing: boolean;
  onAnalyze: () => void;
  onAnswer: () => void;
  onCollapse: () => void;
  onEnd: () => void;
  onModeChange: (mode: "answer" | "analyze" | "chat") => void;
  onToggleAutoAnswer: () => void;
};

export function DesktopOverlayToolbar({
  activeTool,
  autoAnswer,
  durationLabel,
  isGenerating,
  isListening,
  isSystemCapturing,
  onAnalyze,
  onAnswer,
  onCollapse,
  onEnd,
  onModeChange,
  onToggleAutoAnswer,
}: DesktopOverlayToolbarProps) {
  return (
    <header className="desktop-drag flex h-10 items-center justify-between gap-2 rounded-2xl bg-slate-950/95 px-2 text-[11px] text-slate-100 shadow-2xl ring-1 ring-white/10 backdrop-blur">
      <div className="flex min-w-0 shrink-0 items-center gap-1.5 font-semibold">
        <span className="grid size-7 shrink-0 place-items-center rounded-xl bg-blue-600 text-sm font-black">
          K
        </span>
        <span className="max-w-20 truncate whitespace-nowrap">Kasa Cue</span>
        <span className="desktop-no-drag flex h-7 items-center gap-1.5 rounded-xl bg-slate-900 px-2 text-[10px] text-slate-300">
          <AudioLines className="size-3.5" />
          <span
            className={`size-1.5 rounded-full ${
              isListening && isSystemCapturing
                ? "bg-emerald-400"
                : "bg-amber-400"
            }`}
          />
          Live audio
        </span>
      </div>

      <div className="desktop-no-drag flex min-w-0 items-center justify-center gap-1">
        <Button
          className={`h-7 rounded-xl px-2 text-[11px] ${
            autoAnswer
              ? "bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white"
              : "bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
          onClick={onToggleAutoAnswer}
          type="button"
          variant="ghost"
        >
          Auto
        </Button>
        <Button
          className={`h-7 rounded-xl px-2 text-[11px] disabled:text-slate-400 ${
            activeTool === "answer"
              ? "border-amber-400 bg-slate-900 text-amber-100 hover:bg-slate-800 hover:text-amber-100"
              : "bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
          }`}
          disabled={isGenerating}
          onClick={() => {
            onModeChange("answer");
            onAnswer();
          }}
          type="button"
          variant={activeTool === "answer" ? "outline" : "ghost"}
        >
          <Sparkles className="size-3.5" />
          Answer
        </Button>
        <Button
          className={`h-7 rounded-xl px-2 text-[11px] disabled:text-slate-400 ${
            activeTool === "analyze"
              ? "border-amber-400 bg-slate-900 text-amber-100 hover:bg-slate-800 hover:text-amber-100"
              : "bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
          }`}
          disabled={isGenerating}
          onClick={() => {
            onModeChange("analyze");
            onAnalyze();
          }}
          type="button"
          variant={activeTool === "analyze" ? "outline" : "ghost"}
        >
          <ScanLine className="size-3.5" />
          Analyze
        </Button>
        <Button
          className={`h-7 rounded-xl px-2 text-[11px] ${
            activeTool === "chat"
              ? "border-amber-400 bg-slate-900 text-amber-100 hover:bg-slate-800 hover:text-amber-100"
              : "bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
          }`}
          onClick={() => onModeChange("chat")}
          type="button"
          variant={activeTool === "chat" ? "outline" : "ghost"}
        >
          <MessageSquare className="size-3.5" />
          Chat
        </Button>
      </div>

      <div className="desktop-no-drag flex shrink-0 items-center gap-1">
        <span className="rounded-xl bg-slate-900 px-2 py-1.5 text-[11px] font-semibold">
          ∞ {durationLabel}
        </span>
        <Button
          className="size-7 rounded-xl bg-slate-900 p-0 text-slate-300 hover:bg-slate-800 hover:text-white"
          onClick={onEnd}
          type="button"
          variant="ghost"
        >
          <LogOut className="size-3.5" />
        </Button>
        <Button
          className="size-7 rounded-xl bg-slate-900 p-0 text-slate-300 hover:bg-slate-800 hover:text-white"
          onClick={onCollapse}
          type="button"
          variant="ghost"
        >
          <ChevronUp className="size-3.5" />
        </Button>
      </div>
    </header>
  );
}
