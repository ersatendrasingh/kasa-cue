"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { ModeOption } from "./types";

type AnswerPanelProps = {
  activeMode: ModeOption;
  answerIndex: number;
  answersLength: number;
  copied: boolean;
  isGenerating: boolean;
  model: string;
  visibleReply: string;
  onCopy: () => void;
  onNext: () => void;
  onPrevious: () => void;
};

type AnswerPart = {
  content: string;
  language?: string;
  type: "code" | "text";
};

export function AnswerPanel({
  activeMode,
  answerIndex,
  answersLength,
  copied,
  isGenerating,
  model,
  visibleReply,
  onCopy,
  onNext,
  onPrevious,
}: AnswerPanelProps) {
  const ActiveModeIcon = activeMode.icon;

  return (
    <div className="flex min-h-[320px] flex-1 flex-col rounded-xl border border-slate-200 bg-white shadow-sm sm:min-h-[420px] sm:rounded-md">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="size-4 text-amber-500 sm:size-5" />
            <span className="sm:hidden">Answer</span>
            <span className="hidden sm:inline">AI answer</span>
          </div>
          <div className="mt-2 hidden flex-wrap gap-2 sm:flex">
            <Badge variant="outline" className="gap-1.5">
              <ActiveModeIcon className="size-3.5" />
              {activeMode.label}
            </Badge>
            <Badge variant="outline">Model: {model}</Badge>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {isGenerating ? (
            <Badge
              className="gap-2 border-amber-200 bg-amber-50 text-amber-700"
              variant="outline"
            >
              <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
              <span className="hidden sm:inline">Thinking</span>
            </Badge>
          ) : null}
          <Button
            aria-label="Previous answer"
            className="size-8 p-0 sm:w-auto sm:px-3"
            disabled={answerIndex <= 0}
            onClick={onPrevious}
            type="button"
            variant="outline"
          >
            <ChevronLeft className="size-4 sm:hidden" />
            <span className="hidden text-xs sm:inline">Previous</span>
          </Button>
          <span className="min-w-9 text-center text-[11px] text-slate-500 sm:min-w-14 sm:text-xs">
            {answersLength ? `${answerIndex + 1}/${answersLength}` : "0/0"}
          </span>
          <Button
            aria-label="Next answer"
            className="size-8 p-0 sm:w-auto sm:px-3"
            disabled={answerIndex < 0 || answerIndex >= answersLength - 1}
            onClick={onNext}
            type="button"
            variant="outline"
          >
            <ChevronRight className="size-4 sm:hidden" />
            <span className="hidden text-xs sm:inline">Next</span>
          </Button>
          <Button
            aria-label={copied ? "Answer copied" : "Copy answer"}
            className="size-8 gap-2 p-0 sm:w-auto sm:px-3"
            onClick={onCopy}
            type="button"
            variant="outline"
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-600" />
            ) : (
              <Clipboard className="size-3.5" />
            )}
            <span className="hidden text-xs sm:inline">
              {copied ? "Copied" : "Copy"}
            </span>
          </Button>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 sm:px-6 sm:py-5">
        <div className="space-y-4 text-base font-normal leading-7 text-slate-900">
          <FormattedAnswer value={visibleReply} />
        </div>
      </div>
    </div>
  );
}

export function FormattedAnswer({ value }: { value: string }) {
  const parts = splitMarkdownCodeBlocks(value);

  return (
    <>
      {parts.map((part, index) =>
        part.type === "code" ? (
          <div
            className="overflow-hidden rounded-md border border-slate-700 bg-slate-950 shadow-sm"
            key={`${part.type}-${index}`}
          >
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                {part.language || "code"}
              </span>
            </div>
            <pre className="max-h-[420px] overflow-auto px-4 py-4 text-sm leading-6 text-slate-100">
              <code>{part.content}</code>
            </pre>
          </div>
        ) : (
          <div className="whitespace-pre-wrap" key={`${part.type}-${index}`}>
            {part.content}
          </div>
        )
      )}
    </>
  );
}

function splitMarkdownCodeBlocks(value: string) {
  const parts: AnswerPart[] = [];
  const regex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)(?:```|$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        content: value.slice(lastIndex, match.index),
        type: "text",
      });
    }

    parts.push({
      content: match[2].trim(),
      language: match[1]?.trim(),
      type: "code",
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < value.length) {
    parts.push({
      content: value.slice(lastIndex),
      type: "text",
    });
  }

  return parts.length ? parts : ([{ content: value, type: "text" }] satisfies AnswerPart[]);
}
