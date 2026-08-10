export {};

declare global {
  type DesktopUpdateState = {
    available: boolean;
    currentVersion: string;
    downloaded: boolean;
    downloading: boolean;
    downloadUrl?: string;
    error?: string;
    fileName?: string;
    latestVersion?: string;
    progress: number;
    releaseNotes?: string;
  };

  interface Window {
    kasaDesktop?: {
      checkForUpdate: () => Promise<DesktopUpdateState>;
      collapseOverlay: () => Promise<boolean>;
      collapseSetup: () => Promise<boolean>;
      closeWindow: () => Promise<boolean>;
      endOverlay: () => Promise<boolean>;
      expandOverlay: (payload?: {
        mode?: "chat" | "compact" | "result";
      }) => Promise<boolean>;
      expandSetup: () => Promise<boolean>;
      getPlatform: () => Promise<NodeJS.Platform>;
      getScreenSnapshot: () => Promise<{
        dataUrl?: string;
        error?: string;
        permissionRequired?: boolean;
      }>;
      getUpdateState: () => Promise<DesktopUpdateState>;
      downloadUpdate: () => Promise<DesktopUpdateState>;
      installUpdate: () => Promise<DesktopUpdateState>;
      minimizeWindow: () => Promise<boolean>;
      onSession: (
        callback: (payload: { sessionId?: string }) => void
      ) => () => void;
      onUpdateState: (
        callback: (payload: DesktopUpdateState) => void
      ) => () => void;
      openOverlay: (payload: { sessionId: string }) => Promise<boolean>;
      openLogin: () => Promise<boolean>;
      resizeOverlay: (payload: {
        height: number;
        width: number;
      }) => Promise<boolean>;
      setOverlayMode: (mode: "chat" | "compact" | "result") => Promise<boolean>;
      setOpacity: (opacity: number) => Promise<number>;
      toggleAlwaysOnTop: () => Promise<boolean>;
    };
  }
}
