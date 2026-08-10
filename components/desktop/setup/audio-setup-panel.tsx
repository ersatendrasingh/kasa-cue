"use client";

import { ArrowLeft, Mic, RotateCcw, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { DesktopSetupStep } from "./types";

const AUDIO_DEVICE_STORAGE_KEY = "kasa-cue:desktop-audio-input-device-id";
const SYSTEM_AUDIO_DEVICE_STORAGE_KEY =
  "kasa-cue:desktop-system-audio-input-device-id";

type AudioSetupPanelProps = {
  isCreating: boolean;
  onCreateSession: () => void;
  onStepChange: (step: DesktopSetupStep) => void;
};

export function AudioSetupPanel({
  isCreating,
  onCreateSession,
  onStepChange,
}: AudioSetupPanelProps) {
  const [micLevel, setMicLevel] = useState(0);
  const [systemLevel, setSystemLevel] = useState(0);
  const [status, setStatus] = useState("Ready to test microphone.");
  const [isTesting, setIsTesting] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem(AUDIO_DEVICE_STORAGE_KEY) ?? ""
  );
  const [selectedSystemDeviceId, setSelectedSystemDeviceId] = useState(() =>
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem(SYSTEM_AUDIO_DEVICE_STORAGE_KEY) ?? ""
  );
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    void refreshAudioDevices();

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function refreshAudioDevices() {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const availableDevices = await navigator.mediaDevices.enumerateDevices();
      setDevices(
        availableDevices.filter((device) => device.kind === "audioinput")
      );
    } catch {
      setDevices([]);
    }
  }

  async function testMicrophone() {
    setIsTesting(true);
    setStatus("Listening for mic input...");
    setMicLevel(0);

    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: getMicrophoneConstraints(selectedDeviceId),
      });
      streamRef.current = stream;
      void refreshAudioDevices();
      await measureAudioLevel({
        label: "Mic",
        minPeak: 3,
        onLevel: setMicLevel,
        stream,
        successMessage: "Mic is working. You can create the session.",
      });
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `Mic test failed: ${error.message}`
          : "Mic test failed."
      );
    } finally {
      setIsTesting(false);
    }
  }

  async function testSystemAudio() {
    setIsTesting(true);
    setStatus("Testing system audio. Play meeting/browser audio now...");
    setSystemLevel(0);

    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = selectedSystemDeviceId
        ? await navigator.mediaDevices.getUserMedia({
            audio: getSystemAudioConstraints(selectedSystemDeviceId),
          })
        : await getDisplayAudioStream();

      streamRef.current = stream;
      void refreshAudioDevices();
      await measureAudioLevel({
        label: "System",
        minPeak: 2,
        onLevel: setSystemLevel,
        stream,
        successMessage:
          "System audio is working. Keep this source selected for live calls.",
      });
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `System audio test failed: ${error.message}`
          : "System audio test failed."
      );
    } finally {
      setIsTesting(false);
    }
  }

  async function measureAudioLevel({
    label,
    minPeak,
    onLevel,
    stream,
    successMessage,
  }: {
    label: string;
    minPeak: number;
    onLevel: (value: number) => void;
    stream: MediaStream;
    successMessage: string;
  }) {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error("Audio testing is not supported in this environment.");
    }

    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    const samples = new Uint8Array(analyser.frequencyBinCount);
    let peakLevel = 0;

    analyser.fftSize = 256;
    source.connect(analyser);

    await new Promise<void>((resolve) => {
      const startedAt = Date.now();
      const intervalId = window.setInterval(() => {
        analyser.getByteFrequencyData(samples);
        const average =
          samples.reduce((total, value) => total + value, 0) / samples.length;
        const nextLevel = Math.min(100, Math.round((average / 128) * 100));

        peakLevel = Math.max(peakLevel, nextLevel);
        onLevel(nextLevel);

        if (Date.now() - startedAt > 3000) {
          window.clearInterval(intervalId);
          resolve();
        }
      }, 120);
    });

    stream.getTracks().forEach((track) => track.stop());
    void audioContext.close();
    setStatus(
      peakLevel > minPeak
        ? successMessage
        : `${label} connected, but no clear audio detected. Keep audio playing and check the selected source.`
    );
  }

  function getMicrophoneConstraints(deviceId: string): MediaTrackConstraints {
    const audio: MediaTrackConstraints = {
      autoGainControl: true,
      channelCount: 1,
      echoCancellation: false,
      noiseSuppression: false,
    };

    if (deviceId) {
      audio.deviceId = { exact: deviceId };
    }

    return audio;
  }

  function getSystemAudioConstraints(deviceId: string): MediaTrackConstraints {
    return {
      autoGainControl: false,
      channelCount: 2,
      deviceId: { exact: deviceId },
      echoCancellation: false,
      noiseSuppression: false,
    };
  }

  async function getDisplayAudioStream() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error("Screen/system audio capture is not available here.");
    }

    const captureStream = await navigator.mediaDevices.getDisplayMedia({
      audio: {
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false,
      },
      video: true,
    });
    const audioTracks = captureStream.getAudioTracks();

    captureStream.getVideoTracks().forEach((track) => track.stop());

    if (!audioTracks.length) {
      captureStream.getTracks().forEach((track) => track.stop());
      throw new Error(
        "No system audio track was returned. On macOS, select a loopback input such as BlackHole/Loopback, or enable Screen & System Audio Recording and restart Kasa Cue."
      );
    }

    return new MediaStream(audioTracks);
  }

  return (
    <div className="space-y-3.5 p-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-normal text-amber-800">
        Paid session uses your available credits.
      </div>

      <section className="rounded-2xl border border-slate-200 p-3.5">
        <h2 className="mb-3 text-base font-normal">Audio Setup</h2>
        <label className="block space-y-2 text-sm font-normal">
          <span>Microphone</span>
          <select
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition hover:border-slate-400 hover:text-slate-950 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            value={selectedDeviceId}
            onChange={(event) => {
              const nextDeviceId = event.target.value;

              setSelectedDeviceId(nextDeviceId);
              if (nextDeviceId) {
                window.localStorage.setItem(
                  AUDIO_DEVICE_STORAGE_KEY,
                  nextDeviceId
                );
              } else {
                window.localStorage.removeItem(AUDIO_DEVICE_STORAGE_KEY);
              }
            }}
          >
            <option value="">Default Microphone</option>
            {devices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block space-y-2 text-sm font-normal">
          <span>System audio source</span>
          <select
            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition hover:border-slate-400 hover:text-slate-950 focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
            value={selectedSystemDeviceId}
            onChange={(event) => {
              const nextDeviceId = event.target.value;

              setSelectedSystemDeviceId(nextDeviceId);
              if (nextDeviceId) {
                window.localStorage.setItem(
                  SYSTEM_AUDIO_DEVICE_STORAGE_KEY,
                  nextDeviceId
                );
              } else {
                window.localStorage.removeItem(SYSTEM_AUDIO_DEVICE_STORAGE_KEY);
              }
            }}
          >
            <option value="">Auto-detect Loopback/BlackHole, then mic fallback</option>
            {devices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Audio input ${index + 1}`}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 space-y-3 text-sm text-slate-500">
          <Meter icon={<Mic className="size-4" />} label="Mic" value={micLevel} />
          <Meter
            hint="Loopback or screen audio"
            icon={<Volume2 className="size-4" />}
            label="System"
            value={systemLevel}
          />
        </div>

        <p className="mt-3 text-xs text-slate-500">{status}</p>

        <div className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-3">
          <Button
            className="h-10 rounded-xl hover:bg-slate-100 hover:text-slate-950"
            disabled={isTesting}
            onClick={() => void testMicrophone()}
            type="button"
            variant="outline"
          >
            {isTesting ? "Testing..." : "Test Mic"}
          </Button>
          <Button
            className="h-10 rounded-xl hover:bg-slate-100 hover:text-slate-950"
            disabled={isTesting}
            onClick={() => void testSystemAudio()}
            type="button"
            variant="outline"
          >
            {isTesting ? "Testing..." : "Test System"}
          </Button>
          <Button
            className="h-10 gap-2 rounded-xl hover:bg-slate-100 hover:text-slate-950"
            onClick={() => {
              setMicLevel(0);
              setSystemLevel(0);
              setSelectedDeviceId("");
              setSelectedSystemDeviceId("");
              window.localStorage.removeItem(AUDIO_DEVICE_STORAGE_KEY);
              window.localStorage.removeItem(SYSTEM_AUDIO_DEVICE_STORAGE_KEY);
              setStatus("Ready to test microphone.");
            }}
            type="button"
            variant="ghost"
          >
            <RotateCcw className="size-4" />
            Reset
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-[1fr_1.35fr] gap-3 border-t border-slate-100 pt-4">
        <Button
          className="h-11 gap-2 rounded-xl hover:bg-slate-100 hover:text-slate-950"
          onClick={() => onStepChange("details")}
          type="button"
          variant="outline"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button
          className="h-11 rounded-xl bg-slate-950 text-white hover:bg-slate-800 hover:text-white"
          disabled={isCreating}
          onClick={onCreateSession}
          type="button"
        >
          {isCreating ? "Creating..." : "Create Session"}
        </Button>
      </div>
    </div>
  );
}

function Meter({
  hint,
  icon,
  label,
  value,
}: {
  hint?: string;
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="grid grid-cols-[80px_1fr_auto] items-center gap-3">
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="h-2 overflow-hidden rounded-full bg-slate-100">
        <span
          className="block h-full rounded-full bg-emerald-500/70 transition-all"
          style={{ width: `${value}%` }}
        />
      </span>
      <span className="text-right text-xs">{hint ?? (value ? `${value}` : "--")}</span>
    </div>
  );
}
