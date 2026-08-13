"use client";

import {
  Check,
  Clipboard,
  ExternalLink,
  Maximize2,
  Mic,
  Minimize2,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { FormattedAnswer } from "@/components/workspace/answer-panel";

type DocumentPictureInPicture = {
  requestWindow: (options?: {
    disallowReturnToOpener?: boolean;
    height?: number;
    preferInitialWindowPlacement?: boolean;
    width?: number;
  }) => Promise<Window>;
  window: Window | null;
};

type FloatingKasaWindowProps = {
  canAnswer: boolean;
  isGenerating: boolean;
  isListening: boolean;
  liveTranscript: string;
  visibleReply: string;
  onAnswer: () => void;
};

export function FloatingKasaWindow({
  canAnswer,
  isGenerating,
  isListening,
  liveTranscript,
  visibleReply,
  onAnswer,
}: FloatingKasaWindowProps) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openError, setOpenError] = useState("");
  const pipWindowRef = useRef<Window | null>(null);

  const closeFloatingWindow = useCallback(() => {
    const currentWindow = pipWindowRef.current;
    pipWindowRef.current = null;
    setPipWindow(null);
    setIsMinimized(false);

    if (currentWindow && !currentWindow.closed) {
      currentWindow.close();
    }
  }, []);

  useEffect(() => closeFloatingWindow, [closeFloatingWindow]);

  const requestFloatingWindow = useCallback(async (
    minimized = false,
    replaceExisting = false
  ) => {
    setOpenError("");
    const api = getDocumentPictureInPicture();

    if (!api?.requestWindow) {
      setOpenError("Floating mode needs Chrome 116 or newer on desktop.");
      return;
    }

    if (api.window && !api.window.closed && !replaceExisting) {
      api.window.focus();
      return;
    }

    try {
      const previousWindow = pipWindowRef.current;

      // A fresh compact PiP asks Chrome to use its default PiP placement,
      // which is the only web-supported way to request a bottom-corner result.
      // Websites cannot directly set a PiP window's x/y coordinates.
      if (replaceExisting && previousWindow && !previousWindow.closed) {
        pipWindowRef.current = null;
        previousWindow.close();
      }

      const nextWindow = await api.requestWindow({
        disallowReturnToOpener: true,
        height: minimized ? 96 : 620,
        preferInitialWindowPlacement: true,
        width: minimized ? 96 : 420,
      });

      copyPageStyles(nextWindow.document);
      nextWindow.document.title = "Live notes";
      nextWindow.document.documentElement.className = document.documentElement.className;
      nextWindow.document.body.className =
        "m-0 overflow-hidden bg-slate-950 font-sans text-white";
      nextWindow.addEventListener("pagehide", () => {
        if (pipWindowRef.current === nextWindow) {
          pipWindowRef.current = null;
          setPipWindow(null);
          setIsMinimized(false);
        }
      });
      pipWindowRef.current = nextWindow;
      setPipWindow(nextWindow);
      setIsMinimized(minimized);
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setOpenError("Click Float again to allow the floating window.");
        return;
      }

      setOpenError("Floating mode could not open in this browser.");
    }
  }, []);

  const openFloatingWindow = useCallback(
    () => requestFloatingWindow(false),
    [requestFloatingWindow]
  );

  const toggleMinimized = useCallback(() => {
    void requestFloatingWindow(!isMinimized, true);
  }, [isMinimized, requestFloatingWindow]);

  useEffect(() => {
    if (
      !isListening ||
      typeof navigator === "undefined" ||
      !navigator.mediaSession
    ) {
      return;
    }

    const mediaSession = navigator.mediaSession;
    const automaticPipAction =
      "enterpictureinpicture" as MediaSessionAction;

    try {
      mediaSession.setActionHandler(automaticPipAction, () => {
        void openFloatingWindow();
      });
    } catch {
      return;
    }

    return () => {
      try {
        mediaSession.setActionHandler(automaticPipAction, null);
      } catch {
        // Older Chromium builds can reject an unknown media session action.
      }
    };
  }, [isListening, openFloatingWindow]);

  async function copyAnswer() {
    if (!visibleReply.trim()) return;
    await navigator.clipboard.writeText(visibleReply);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <>
      <div className="hidden sm:block">
        {openError ? (
          <div className="fixed left-1/2 top-20 z-50 max-w-80 -translate-x-1/2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900 shadow-lg">
            {openError}
          </div>
        ) : null}
        <Button
          aria-label={pipWindow ? "Focus floating Kasa" : "Open floating Kasa"}
          className="h-10 w-10 gap-2 rounded-xl border border-slate-200 bg-white p-0 text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-950 xl:w-auto xl:px-3"
          onClick={() => void openFloatingWindow()}
          title="Keep transcript and answers above other windows"
          type="button"
          variant="outline"
        >
          <ExternalLink className="size-4" />
          <span className="hidden xl:inline">{pipWindow ? "Floating" : "Float"}</span>
          {pipWindow ? (
            <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
          ) : null}
        </Button>
      </div>

      {pipWindow
        ? createPortal(
            <FloatingPanel
              canAnswer={canAnswer}
              copied={copied}
              isMinimized={isMinimized}
              isGenerating={isGenerating}
              isListening={isListening}
              liveTranscript={liveTranscript}
              visibleReply={visibleReply}
              onAnswer={onAnswer}
              onCopy={() => void copyAnswer()}
              onToggleMinimized={toggleMinimized}
            />,
            pipWindow.document.body
          )
        : null}
    </>
  );
}

function FloatingPanel({
  canAnswer,
  copied,
  isMinimized,
  isGenerating,
  isListening,
  liveTranscript,
  visibleReply,
  onAnswer,
  onCopy,
  onToggleMinimized,
}: FloatingKasaWindowProps & {
  copied: boolean;
  isMinimized: boolean;
  onCopy: () => void;
  onToggleMinimized: () => void;
}) {
  if (isMinimized) {
    return (
      <main className="grid h-screen place-items-center overflow-hidden bg-transparent text-white">
        <button
          aria-label="Restore live notes"
          className="grid size-11 place-items-center rounded-full border border-white/15 bg-slate-950 text-white shadow-xl transition hover:scale-105 hover:bg-slate-800"
          onClick={onToggleMinimized}
          title="Restore"
          type="button"
        >
          <Maximize2 className="size-4" />
        </button>
      </main>
    );
  }

  return (
    <main className="relative flex h-screen min-h-0 flex-col overflow-hidden bg-slate-950 text-white">
      <button
        aria-label="Minimize live notes"
        className="absolute right-2 top-2 z-20 grid size-7 place-items-center rounded-lg bg-slate-900 text-slate-300 ring-1 ring-white/10 transition hover:bg-slate-800 hover:text-white"
        onClick={onToggleMinimized}
        title="Minimize"
        type="button"
      >
        <Minimize2 className="size-3.5" />
      </button>
      <section className="shrink-0 border-b border-white/10 bg-white/[0.04] py-2 pl-3 pr-11">
        <div className="mb-1 flex items-center gap-2">
          <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-400">
            <Mic className="size-3" />
            {isListening ? "Listening" : "Ready"}
          </div>
        </div>
        <p className="line-clamp-2 min-h-8 text-xs leading-4.5 text-slate-100">
          {liveTranscript.trim() || "Listening for the latest words…"}
          {liveTranscript.trim() ? (
            <span className="ml-1 inline-block h-3 w-0.5 translate-y-0.5 animate-pulse bg-emerald-400" />
          ) : null}
        </p>
      </section>

      <section className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3 overscroll-contain">
        <div className="sticky top-0 z-10 mb-2 flex items-center justify-between gap-2 bg-slate-950/95 pb-2 backdrop-blur">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-amber-400">
            <Sparkles className="size-3.5" />
            Suggested answer
          </div>
          <button
            aria-label="Copy answer"
            className="grid size-7 place-items-center rounded-lg border border-white/10 text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            disabled={!visibleReply.trim()}
            onClick={onCopy}
            title="Copy answer"
            type="button"
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-400" />
            ) : (
              <Clipboard className="size-3.5" />
            )}
          </button>
        </div>
        <div className="space-y-4 text-sm leading-6 text-slate-100">
          {visibleReply.trim() ? (
            <FormattedAnswer value={visibleReply} />
          ) : (
            <p className="text-slate-500">
              Your generated answer will appear here.
            </p>
          )}
        </div>
      </section>

      <footer className="shrink-0 border-t border-white/10 bg-slate-950 px-3 py-2.5">
        <Button
          className="h-10 w-full gap-2 rounded-xl bg-white text-sm font-semibold text-slate-950 hover:bg-slate-200"
          disabled={!canAnswer || isGenerating}
          onClick={onAnswer}
          type="button"
        >
          {isGenerating ? (
            <Sparkles className="size-4 animate-pulse" />
          ) : (
            <WandSparkles className="size-4" />
          )}
          {isGenerating ? "Preparing answer…" : "Generate answer"}
        </Button>
      </footer>
    </main>
  );
}

function getDocumentPictureInPicture() {
  return (
    window as Window & {
      documentPictureInPicture?: DocumentPictureInPicture;
    }
  ).documentPictureInPicture;
}

function copyPageStyles(targetDocument: Document) {
  for (const styleSheet of Array.from(document.styleSheets)) {
    try {
      const cssText = Array.from(styleSheet.cssRules)
        .map((rule) => rule.cssText)
        .join("\n");
      const style = targetDocument.createElement("style");
      style.textContent = cssText;
      targetDocument.head.appendChild(style);
    } catch {
      if (!styleSheet.href) continue;
      const link = targetDocument.createElement("link");
      link.rel = "stylesheet";
      link.href = styleSheet.href;
      targetDocument.head.appendChild(link);
    }
  }
}
