"use client";

import { Download, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export function DesktopUpdateBanner() {
  const [update, setUpdate] = useState<DesktopUpdateState | null>(null);

  useEffect(() => {
    if (
      !window.kasaDesktop?.getUpdateState ||
      !window.kasaDesktop?.onUpdateState ||
      !window.kasaDesktop?.checkForUpdate
    ) {
      return;
    }

    void window.kasaDesktop.getUpdateState().then(setUpdate);
    const unsubscribe = window.kasaDesktop.onUpdateState(setUpdate);
    void window.kasaDesktop.checkForUpdate().then(setUpdate);

    return unsubscribe;
  }, []);

  if (!update?.available) {
    return null;
  }

  async function handleUpdate() {
    if (
      !window.kasaDesktop?.downloadUpdate ||
      !window.kasaDesktop?.installUpdate
    ) {
      return;
    }

    setUpdate(
      update?.downloaded
        ? await window.kasaDesktop.installUpdate()
        : await window.kasaDesktop.downloadUpdate()
    );
  }

  return (
    <div className="desktop-no-drag flex items-center gap-3 border-t border-blue-100 bg-blue-50 px-4 py-2.5 text-blue-950">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">
          Kasa Cue {update.latestVersion} is ready
        </p>
        <p className="truncate text-[11px] text-blue-700">
          {update.downloading
            ? `Downloading update... ${update.progress}%`
            : update.downloaded
              ? "Download complete. Open the installer to upgrade."
              : update.releaseNotes || "A new desktop update is available."}
        </p>
      </div>
      <Button
        className="h-8 shrink-0 gap-1.5 rounded-lg bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
        disabled={update.downloading}
        onClick={() => void handleUpdate()}
        type="button"
      >
        {update.downloading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : update.downloaded ? (
          <RefreshCw className="size-3.5" />
        ) : (
          <Download className="size-3.5" />
        )}
        {update.downloading
          ? `${update.progress}%`
          : update.downloaded
            ? "Install"
            : "Upgrade"}
      </Button>
    </div>
  );
}
