import { readFile } from "node:fs/promises";
import path from "node:path";

const RELEASES: Record<
  string,
  {
    downloadUrl: string;
    fileName: string;
  }
> = {
  "mac-arm64": {
    downloadUrl: "/api/desktop/download?platform=mac-arm64",
    fileName: "Kasa-Cue-mac-arm64.dmg",
  },
  "mac-x64": {
    downloadUrl: "/api/desktop/download?platform=mac-x64",
    fileName: "Kasa-Cue-mac-x64.dmg",
  },
  "windows-x64": {
    downloadUrl: "/api/desktop/download?platform=windows-x64",
    fileName: "Kasa-Cue-win-x64.exe",
  },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") ?? "";
  const currentVersion = searchParams.get("version") ?? "0.0.0";
  const release = RELEASES[platform];

  if (!release) {
    return Response.json(
      { error: "Updates are not available for this platform." },
      { status: 404 }
    );
  }

  const latestVersion = await readDesktopVersion();

  return Response.json({
    available:
      Boolean(latestVersion) &&
      compareVersions(latestVersion, currentVersion) > 0,
    currentVersion,
    downloaded: false,
    downloading: false,
    latestVersion: latestVersion || currentVersion,
    progress: 0,
    releaseNotes:
      "Improved Normal Talk accuracy, transcription continuity, login security, and in-app updates.",
    ...release,
  });
}

async function readDesktopVersion() {
  if (process.env.KASA_DESKTOP_VERSION?.trim()) {
    return process.env.KASA_DESKTOP_VERSION.trim();
  }

  const roots = [
    process.cwd(),
    process.env.KASA_CUE_ROOT,
    process.env.APP_ROOT,
    "/var/www/kasa-cue",
  ].filter(Boolean) as string[];

  for (const root of roots) {
    try {
      const value = await readFile(path.join(root, "electron", "package.json"), "utf8");
      const packageJson = JSON.parse(value) as { version?: string };

      if (packageJson.version?.trim()) {
        return packageJson.version.trim();
      }
    } catch {
      // Try the next deployment root.
    }
  }

  return "";
}

function compareVersions(left: string, right: string) {
  const leftParts = normalizeVersion(left);
  const rightParts = normalizeVersion(right);

  for (let index = 0; index < 3; index += 1) {
    const difference = leftParts[index] - rightParts[index];

    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

function normalizeVersion(value: string) {
  const parts = value
    .replace(/^v/i, "")
    .split(".")
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);

  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}
