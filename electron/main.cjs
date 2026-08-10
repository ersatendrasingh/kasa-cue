/* eslint-disable @typescript-eslint/no-require-imports */
const {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  net,
  screen,
  session,
  shell,
  systemPreferences,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const APP_URL =
  process.env.KASA_WEB_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://cue.getkasa.in";
const APP_ICON = app.isPackaged
  ? path.join(process.resourcesPath, "assets", "kasa-icon.png")
  : path.join(__dirname, "assets", "kasa-icon.png");

let setupWindow;
let setupExpandedBounds;
let overlayWindow;
let overlayExpandedBounds;
let isSessionActive = false;
let isSetupClosingForSession = false;
let isQuitting = false;
let pendingDeepLinkUrl = null;
let lastScreenPermissionPromptAt = 0;
let downloadedUpdatePath = null;
let updateState = {
  available: false,
  currentVersion: app.getVersion(),
  downloaded: false,
  downloading: false,
  progress: 0,
};
const hasSingleInstanceLock = app.requestSingleInstanceLock();

const SETUP_EXPANDED_SIZE = { height: 600, width: 560 };
const SETUP_COLLAPSED_SIZE = { height: 56, width: 56 };
const OVERLAY_COMPACT_SIZE = { height: 112, width: 600 };
const OVERLAY_CHAT_SIZE = { height: 172, width: 600 };
const OVERLAY_COLLAPSED_SIZE = { height: 56, width: 56 };
const OVERLAY_RESULT_SIZE = { height: 430, width: 780 };

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    const deepLinkUrl = findDeepLink(commandLine);

    if (deepLinkUrl) {
      handleDeepLink(deepLinkUrl);
      return;
    }

    const activeWindow = overlayWindow ?? setupWindow;
    if (activeWindow && !activeWindow.isDestroyed()) {
      if (activeWindow.isMinimized()) {
        activeWindow.restore();
      }
      activeWindow.show();
      activeWindow.focus();
    }
  });
}

function createSetupWindow() {
  setupWindow = new BrowserWindow({
    backgroundColor: "#00000000",
    frame: false,
    hasShadow: false,
    height: SETUP_EXPANDED_SIZE.height,
    minHeight: 56,
    minWidth: 56,
    show: false,
    skipTaskbar: true,
    title: "Kasa Cue",
    transparent: true,
    icon: APP_ICON,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
    width: SETUP_EXPANDED_SIZE.width,
  });
  setupWindow.setContentProtection(true);

  setupExpandedBounds = getCenteredBounds(
    SETUP_EXPANDED_SIZE.width,
    SETUP_EXPANDED_SIZE.height
  );
  setupWindow.setBounds(setupExpandedBounds, false);
  setupWindow.loadURL(`${APP_URL}/desktop`);
  setupWindow.once("ready-to-show", () => {
    if (!isSessionActive) {
      setupWindow?.show();
    }
  });
  setupWindow.webContents.on("did-finish-load", () => {
    showSetupWindow();
  });
  setTimeout(() => {
    showSetupWindow();
  }, 1800);
  setupWindow.webContents.on("did-fail-load", (_event, _code, description) => {
    showSetupFallback(
      `Could not load Kasa Cue desktop page. ${description || "Start the web app and try again."}`
    );
  });
  setupWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  setupWindow.on("page-title-updated", (event) => {
    event.preventDefault();
    setupWindow?.setTitle("Kasa Cue");
  });
  setupWindow.on("closed", () => {
    setupWindow = null;

    if (isSetupClosingForSession) {
      isSetupClosingForSession = false;
      return;
    }

    if (!isQuitting && overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
    }
  });
}

function createOverlayWindow({ sessionId }) {
  isSessionActive = true;

  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.setSkipTaskbar(true);
    setupWindow.setFocusable(false);
    setupWindow.hide();
  }

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    closeSetupWindowForSession();
    overlayWindow.focus();
    overlayWindow.webContents.send("desktop:session", { sessionId });
    return;
  }

  overlayWindow = new BrowserWindow({
    alwaysOnTop: true,
    backgroundColor: "#00000000",
    frame: false,
    hasShadow: false,
    height: OVERLAY_COMPACT_SIZE.height,
    minHeight: 56,
    minWidth: 56,
    opacity: 0.92,
    resizable: true,
    show: false,
    skipTaskbar: true,
    title: "Kasa Cue Overlay",
    transparent: true,
    icon: APP_ICON,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
    width: OVERLAY_COMPACT_SIZE.width,
  });
  overlayWindow.setContentProtection(true);

  overlayWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
  });
  overlayExpandedBounds = getCenteredBounds(
    OVERLAY_RESULT_SIZE.width,
    OVERLAY_RESULT_SIZE.height
  );
  closeSetupWindowForSession();
  overlayWindow.setBounds(
    getCenteredBounds(OVERLAY_COMPACT_SIZE.width, OVERLAY_COMPACT_SIZE.height),
    false
  );
  overlayWindow.loadURL(
    `${APP_URL}/desktop/overlay?sessionId=${encodeURIComponent(sessionId || "")}`
  );
  overlayWindow.once("ready-to-show", () => {
    closeSetupWindowForSession();
    overlayWindow?.show();
  });
  overlayWindow.on("page-title-updated", (event) => {
    event.preventDefault();
    overlayWindow?.setTitle("Kasa Cue");
  });
  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
}

function showSetupWindow() {
  if (isSessionActive || !setupWindow || setupWindow.isDestroyed()) {
    return;
  }

  setupWindow.setBounds(setupExpandedBounds, false);
  setupWindow.setFocusable(true);
  setupWindow.setSkipTaskbar(true);
  showAndFocusWindow(setupWindow);
}

function showAndFocusWindow(window) {
  if (!window || window.isDestroyed()) {
    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.moveTop();
  window.focus();
}

app.whenReady().then(() => {
  app.setName("Kasa Cue");
  app.setAsDefaultProtocolClient("kasa-cue");
  if (process.platform === "darwin") {
    app.setActivationPolicy?.("accessory");
    app.dock?.hide();
  }
  configureDesktopPermissions();
  createSetupWindow();
  setTimeout(() => {
    void checkForDesktopUpdate();
  }, 3500);
  const launchDeepLink = findDeepLink(process.argv);
  if (launchDeepLink) {
    pendingDeepLinkUrl = launchDeepLink;
  }
  if (pendingDeepLinkUrl) {
    handleDeepLink(pendingDeepLinkUrl);
    pendingDeepLinkUrl = null;
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createSetupWindow();
      return;
    }

    if (!isSessionActive) {
      showSetupWindow();
    }
  });
});

app.on("open-url", (event, url) => {
  event.preventDefault();

  if (app.isReady()) {
    handleDeepLink(url);
    return;
  }

  pendingDeepLinkUrl = url;
});

function closeSetupWindowForSession() {
  if (!setupWindow || setupWindow.isDestroyed()) {
    return;
  }

  isSetupClosingForSession = true;
  setupWindow.removeAllListeners("ready-to-show");
  setupWindow.setSkipTaskbar(true);
  setupWindow.setFocusable(false);
  setupWindow.hide();
  setupWindow.destroy();
}

function configureDesktopPermissions() {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      const allowedPermissions = new Set([
        "display-capture",
        "media",
        "mediaKeySystem",
      ]);

      callback(allowedPermissions.has(permission));
    }
  );

  if (session.defaultSession.setDisplayMediaRequestHandler) {
    session.defaultSession.setDisplayMediaRequestHandler(
      async (_request, callback) => {
        const sources = await desktopCapturer.getSources({
          thumbnailSize: { height: 720, width: 1280 },
          types: ["screen"],
        });

        if (!sources[0]) {
          callback({});
          return;
        }

        callback({
          audio:
            process.platform === "win32" || process.platform === "darwin"
              ? "loopback"
              : undefined,
          video: sources[0],
        });
      }
    );
  }
}

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
});

ipcMain.handle("desktop:open-overlay", (_event, payload = {}) => {
  createOverlayWindow({ sessionId: payload.sessionId });
  return true;
});

ipcMain.handle("desktop:close-window", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (window === setupWindow) {
    isQuitting = true;
    BrowserWindow.getAllWindows().forEach((openWindow) => openWindow.close());
    app.quit();
    return true;
  }

  window?.close();
  return true;
});

ipcMain.handle("desktop:minimize-window", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
  return true;
});

ipcMain.handle("desktop:get-platform", () => process.platform);
ipcMain.handle("desktop:get-update-state", () => updateState);
ipcMain.handle("desktop:check-for-update", () => checkForDesktopUpdate());
ipcMain.handle("desktop:download-update", () => downloadDesktopUpdate());
ipcMain.handle("desktop:install-update", async () => {
  if (!downloadedUpdatePath) {
    return { ...updateState, error: "The update has not finished downloading." };
  }

  const openError = await shell.openPath(downloadedUpdatePath);

  return openError ? { ...updateState, error: openError } : updateState;
});

ipcMain.handle("desktop:open-login", async () => {
  await shell.openExternal(`${APP_URL}/api/desktop/auth/start`);
  return true;
});

ipcMain.handle("desktop:collapse-setup", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (!window) {
    return false;
  }

  const currentBounds = window.getBounds();

  if (
    currentBounds.width > SETUP_COLLAPSED_SIZE.width ||
    currentBounds.height > SETUP_COLLAPSED_SIZE.height
  ) {
    setupExpandedBounds = currentBounds;
  }

  window.setMinimumSize(SETUP_COLLAPSED_SIZE.width, SETUP_COLLAPSED_SIZE.height);
  window.setMaximumSize(SETUP_COLLAPSED_SIZE.width, SETUP_COLLAPSED_SIZE.height);
  window.setBounds(
    getCenteredBounds(SETUP_COLLAPSED_SIZE.width, SETUP_COLLAPSED_SIZE.height),
    false
  );
  window.setContentSize(SETUP_COLLAPSED_SIZE.width, SETUP_COLLAPSED_SIZE.height);
  window.setResizable(false);
  window.setFocusable(false);
  window.setSkipTaskbar(true);
  window.setAlwaysOnTop(true, "floating");
  window.blur();
  return true;
});

ipcMain.handle("desktop:expand-setup", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (!window) {
    return false;
  }

  window.setResizable(true);
  window.setFocusable(true);
  window.setSkipTaskbar(true);
  window.setMaximumSize(10000, 10000);
  window.setMinimumSize(56, 56);
  window.setBounds(
    setupExpandedBounds ||
      getCenteredBounds(SETUP_EXPANDED_SIZE.width, SETUP_EXPANDED_SIZE.height),
    true
  );
  window.setAlwaysOnTop(false);
  window.focus();
  return true;
});

ipcMain.handle("desktop:collapse-overlay", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (!window) {
    return false;
  }

  const currentBounds = window.getBounds();

  if (
    currentBounds.width > OVERLAY_COMPACT_SIZE.width ||
    currentBounds.height > OVERLAY_COMPACT_SIZE.height
  ) {
    overlayExpandedBounds = currentBounds;
  }

  window.setMinimumSize(OVERLAY_COLLAPSED_SIZE.width, OVERLAY_COLLAPSED_SIZE.height);
  window.setMaximumSize(OVERLAY_COLLAPSED_SIZE.width, OVERLAY_COLLAPSED_SIZE.height);
  window.setBounds(
    getCenteredBounds(
      OVERLAY_COLLAPSED_SIZE.width,
      OVERLAY_COLLAPSED_SIZE.height
    ),
    false
  );
  window.setContentSize(
    OVERLAY_COLLAPSED_SIZE.width,
    OVERLAY_COLLAPSED_SIZE.height
  );
  window.setResizable(false);
  window.setFocusable(false);
  window.setSkipTaskbar(true);
  window.setAlwaysOnTop(true, "floating");
  window.blur();
  return true;
});

ipcMain.handle("desktop:expand-overlay", (event, payload = {}) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (!window) {
    return false;
  }

  window.setResizable(true);
  window.setFocusable(true);
  window.setSkipTaskbar(true);
  window.setMaximumSize(10000, 10000);
  window.setMinimumSize(56, 56);
  window.setBounds(
    payload.mode === "result"
      ? overlayExpandedBounds || getOverlayBounds(OVERLAY_RESULT_SIZE)
      : payload.mode === "chat"
        ? getOverlayBounds(OVERLAY_CHAT_SIZE)
        : getOverlayBounds(OVERLAY_COMPACT_SIZE),
    true
  );
  window.setAlwaysOnTop(true, "floating");
  window.focus();
  return true;
});

ipcMain.handle("desktop:set-overlay-mode", (event, mode) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (!window) {
    return false;
  }

  window.setResizable(true);
  window.setFocusable(true);
  window.setSkipTaskbar(true);
  window.setMaximumSize(10000, 10000);
  window.setMinimumSize(56, 56);

  if (mode === "result") {
    const resultBounds = overlayExpandedBounds || getOverlayBounds(OVERLAY_RESULT_SIZE);

    overlayExpandedBounds = resultBounds;
    window.setBounds(resultBounds, true);
    return true;
  }

  if (mode === "chat") {
    window.setBounds(getOverlayBounds(OVERLAY_CHAT_SIZE), true);
    return true;
  }

  window.setBounds(getOverlayBounds(OVERLAY_COMPACT_SIZE), true);
  return true;
});

ipcMain.handle("desktop:end-overlay", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  isSessionActive = false;
  window?.close();
  if (setupWindow && !setupWindow.isDestroyed()) {
    setupWindow.setFocusable(true);
    setupWindow.setSkipTaskbar(true);
    setupWindow.show();
    setupWindow.focus();
  } else {
    createSetupWindow();
  }

  return true;
});

ipcMain.handle("desktop:get-screen-snapshot", async (event) => {
  const sourceWindow = BrowserWindow.fromWebContents(event.sender);
  const shouldRestoreWindow =
    sourceWindow && !sourceWindow.isDestroyed() && sourceWindow.isVisible();
  const shouldRestoreContentProtection =
    sourceWindow && !sourceWindow.isDestroyed();
  const screenAccess =
    process.platform === "darwin"
      ? systemPreferences.getMediaAccessStatus("screen")
      : "unknown";

  try {
    if (shouldRestoreWindow) {
      sourceWindow.setContentProtection(false);
      sourceWindow.hide();
      await new Promise((resolve) => setTimeout(resolve, 220));
    }

    const cursorPoint = screen.getCursorScreenPoint();
    const targetDisplay = screen.getDisplayNearestPoint(cursorPoint);
    const maxWidth = 1920;
    const scale = Math.min(1, maxWidth / targetDisplay.bounds.width);
    const captureOptions = {
      thumbnailSize: {
        height: Math.round(targetDisplay.bounds.height * scale),
        width: Math.round(targetDisplay.bounds.width * scale),
      },
      types: ["screen"],
    };
    const sources = await desktopCapturer.getSources(captureOptions);
    const primarySource = sources.find(
      (source) =>
        source.display_id === String(targetDisplay.id) &&
        !source.thumbnail.isEmpty()
    );
    const firstUsableSource = sources.find(
      (source) => !source.thumbnail.isEmpty()
    );
    const source = primarySource ?? firstUsableSource;

    if (!source) {
      if (screenAccess !== "granted") {
        await showScreenPermissionDialog(screenAccess);

        return {
          error: `Screen Recording permission is ${screenAccess}.`,
          permissionRequired: true,
        };
      }

      return {
        error:
          [
            `Kasa Cue could not read any screen pixels. Screen sources: ${sources.length}. Permission status: ${screenAccess}.`,
            "Screen capture is enabled in Settings, but macOS did not return screen pixels to Electron.",
          ]
            .filter(Boolean)
            .join(" "),
      };
    }

    return { dataUrl: source.thumbnail.toDataURL() };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (screenAccess !== "granted") {
      await showScreenPermissionDialog(screenAccess);

      return {
        error: `Screen Recording permission is ${screenAccess}.`,
        permissionRequired: true,
      };
    }

    return {
      error:
        [
          message && !message.toLowerCase().includes("capture")
            ? message
            : "Kasa Cue could not take the full-screen snapshot from Electron desktop capture.",
          `Permission status: ${screenAccess}.`,
        ]
          .filter(Boolean)
          .join(" "),
    };
  } finally {
    if (shouldRestoreContentProtection && sourceWindow && !sourceWindow.isDestroyed()) {
      sourceWindow.setContentProtection(true);
    }

    if (shouldRestoreWindow && sourceWindow && !sourceWindow.isDestroyed()) {
      sourceWindow.showInactive();
      sourceWindow.setAlwaysOnTop(true, "floating");
    }
  }
});

async function showScreenPermissionDialog(screenAccess) {
  const now = Date.now();

  if (now - lastScreenPermissionPromptAt < 10000) {
    return;
  }

  lastScreenPermissionPromptAt = now;
  const result = await dialog.showMessageBox({
    buttons: ["Open System Settings", "Cancel"],
    cancelId: 1,
    defaultId: 0,
    message: "Kasa Cue needs Screen Recording permission to analyze your screen.",
    detail: `Current macOS permission status: ${screenAccess}. Enable Kasa Cue in Privacy & Security > Screen & System Audio Recording, then restart Kasa Cue.`,
    type: "warning",
  });

  if (result.response === 0) {
    shell.openExternal(
      "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
    );
  }
}

ipcMain.handle("desktop:set-opacity", (event, opacity) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const nextOpacity = Math.min(1, Math.max(0.35, Number(opacity) || 0.92));

  window?.setOpacity(nextOpacity);
  return nextOpacity;
});

ipcMain.handle("desktop:resize-overlay", (event, payload = {}) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (!window) {
    return false;
  }

  const width = Math.max(600, Math.min(1100, Number(payload.width) || 780));
  const height = Math.max(360, Math.min(760, Number(payload.height) || 430));
  const currentBounds = window.getBounds();

  window.setBounds({ ...currentBounds, height, width }, false);
  overlayExpandedBounds = window.getBounds();
  return true;
});

ipcMain.handle("desktop:toggle-always-on-top", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (!window) {
    return false;
  }

  const nextValue = !window.isAlwaysOnTop();
  window.setAlwaysOnTop(nextValue);
  return nextValue;
});

function getCenteredBounds(width, height) {
  const display = screen.getPrimaryDisplay();
  const safeWidth = Math.min(width, display.workArea.width - 32);
  const x = Math.round(
    display.workArea.x + (display.workArea.width - safeWidth) / 2
  );
  const y = display.workArea.y + 16;

  return { height, width: safeWidth, x, y };
}

function getOverlayBounds(size) {
  const display = screen.getPrimaryDisplay();
  const width = Math.max(
    size.width,
    Math.round(Math.min(display.workArea.width - 32, display.workArea.width * 0.92))
  );

  return getCenteredBounds(width, size.height);
}

function handleDeepLink(url) {
  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    return;
  }

  if (parsedUrl.protocol !== "kasa-cue:" || parsedUrl.hostname !== "auth") {
    return;
  }

  const token = parsedUrl.searchParams.get("token");

  if (!token) {
    return;
  }

  isSessionActive = false;
  if (!setupWindow || setupWindow.isDestroyed()) {
    createSetupWindow();
  }

  setupWindow.setFocusable(true);
  setupWindow.setSkipTaskbar(true);
  setupWindow.setAlwaysOnTop(false);
  setupWindow.loadURL(
    `${APP_URL}/api/desktop/auth/complete?token=${encodeURIComponent(token)}`
  );
  setupWindow.show();
  setupWindow.focus();
}

function findDeepLink(values = []) {
  return values.find(
    (value) => typeof value === "string" && value.startsWith("kasa-cue://")
  );
}

async function checkForDesktopUpdate() {
  if (!app.isPackaged && process.env.KASA_ENABLE_UPDATES !== "true") {
    return updateState;
  }

  try {
    const platform = getDesktopUpdatePlatform();
    const response = await net.fetch(
      `${APP_URL}/api/desktop/update?platform=${encodeURIComponent(platform)}&version=${encodeURIComponent(app.getVersion())}`,
      { cache: "no-store" }
    );
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not check for updates.");
    }

    updateState = {
      ...updateState,
      ...data,
      currentVersion: app.getVersion(),
      downloaded: false,
      downloading: false,
      error: "",
      progress: 0,
    };
    downloadedUpdatePath = null;
    sendUpdateState();
  } catch (error) {
    updateState = {
      ...updateState,
      error:
        error instanceof Error ? error.message : "Could not check for updates.",
    };
    sendUpdateState();
  }

  return updateState;
}

async function downloadDesktopUpdate() {
  if (!updateState.available || !updateState.downloadUrl) {
    return checkForDesktopUpdate();
  }

  if (updateState.downloading || updateState.downloaded) {
    return updateState;
  }

  const fileName =
    updateState.fileName ||
    (process.platform === "win32"
      ? "Kasa-Cue-win-x64.exe"
      : `Kasa-Cue-mac-${process.arch}.dmg`);
  const targetPath = path.join(app.getPath("temp"), fileName);

  updateState = {
    ...updateState,
    downloaded: false,
    downloading: true,
    error: "",
    progress: 0,
  };
  sendUpdateState();

  try {
    const response = await net.fetch(new URL(updateState.downloadUrl, APP_URL), {
      cache: "no-store",
    });

    if (!response.ok || !response.body) {
      throw new Error(`Update download failed (${response.status}).`);
    }

    const totalBytes = Number(response.headers.get("content-length")) || 0;
    let receivedBytes = 0;
    const progressStream = new Transform({
      transform(chunk, _encoding, callback) {
        receivedBytes += chunk.length;
        const progress = totalBytes
          ? Math.min(99, Math.round((receivedBytes / totalBytes) * 100))
          : updateState.progress;

        if (progress !== updateState.progress) {
          updateState = { ...updateState, progress };
          sendUpdateState();
        }

        callback(null, chunk);
      },
    });

    await pipeline(
      Readable.fromWeb(response.body),
      progressStream,
      fs.createWriteStream(targetPath)
    );

    downloadedUpdatePath = targetPath;
    updateState = {
      ...updateState,
      downloaded: true,
      downloading: false,
      progress: 100,
    };
    sendUpdateState();
  } catch (error) {
    downloadedUpdatePath = null;
    updateState = {
      ...updateState,
      downloaded: false,
      downloading: false,
      error:
        error instanceof Error ? error.message : "Could not download update.",
      progress: 0,
    };
    sendUpdateState();
  }

  return updateState;
}

function getDesktopUpdatePlatform() {
  if (process.platform === "win32") {
    return "windows-x64";
  }

  return process.arch === "x64" ? "mac-x64" : "mac-arm64";
}

function sendUpdateState() {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("desktop:update-state", updateState);
  }
}

function showSetupFallback(message) {
  if (!setupWindow || setupWindow.isDestroyed()) {
    return;
  }

  setupWindow.setBounds(setupExpandedBounds, false);
  setupWindow.show();
  setupWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            html, body {
              background: transparent;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              height: 100%;
              margin: 0;
            }
            body {
              align-items: center;
              box-sizing: border-box;
              display: flex;
              justify-content: center;
              padding: 12px;
            }
            .card {
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 18px;
              box-shadow: 0 24px 70px rgba(15, 23, 42, 0.24);
              box-sizing: border-box;
              color: #0f172a;
              overflow: hidden;
              width: 520px;
            }
            .header {
              align-items: center;
              border-bottom: 1px solid #f1f5f9;
              display: flex;
              height: 56px;
              justify-content: space-between;
              padding: 0 16px;
              -webkit-app-region: drag;
            }
            .brand { align-items: center; display: flex; gap: 12px; font-weight: 700; }
            .logo {
              align-items: center;
              background: #2563eb;
              border-radius: 12px;
              color: white;
              display: grid;
              font-size: 18px;
              height: 32px;
              place-items: center;
              width: 32px;
            }
            button {
              -webkit-app-region: no-drag;
              border: 0;
              border-radius: 12px;
              cursor: pointer;
              font: inherit;
              font-weight: 700;
              height: 40px;
              padding: 0 14px;
            }
            .close { background: #ef4444; color: white; height: 36px; width: 36px; }
            .body { padding: 28px; }
            h1 { font-size: 24px; margin: 0 0 8px; }
            p { color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 18px; }
            .primary { background: #0f172a; color: white; width: 100%; }
            .message {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              color: #475569;
              font-size: 12px;
              line-height: 1.5;
              margin-top: 14px;
              padding: 10px;
            }
          </style>
        </head>
        <body>
          <main class="card">
            <header class="header">
              <div class="brand"><span class="logo">K</span><span>Kasa Cue</span></div>
              <button class="close" onclick="window.kasaDesktop?.closeWindow?.()">×</button>
            </header>
            <section class="body">
              <h1>Open Kasa Cue</h1>
              <p>The desktop shell is visible, but the web app did not load. Start the local web app, or continue login in the browser.</p>
              <button class="primary" onclick="window.kasaDesktop?.openLogin?.()">Sign in in browser</button>
              <div class="message">${escapeHtml(message)}</div>
            </section>
          </main>
        </body>
      </html>
    `)}`
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
