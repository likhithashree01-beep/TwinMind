"use client";

const PREFERRED_MIMES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

export function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of PREFERRED_MIMES) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export function fileExtForMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

type RotatingRecorderOptions = {
  chunkMs: number;
  onChunk: (blob: Blob) => void;
  onError: (err: Error) => void;
};

/**
 * RotatingRecorder: stops & restarts MediaRecorder every `chunkMs` so each
 * delivered Blob is a complete, self-contained audio file Whisper can decode.
 */
export class RotatingRecorder {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private rotateTimer: ReturnType<typeof setTimeout> | null = null;
  private mimeType = "";
  private stopped = true;
  private onChunk: (blob: Blob) => void;
  private onError: (err: Error) => void;
  private chunkMs: number;

  constructor(opts: RotatingRecorderOptions) {
    this.onChunk = opts.onChunk;
    this.onError = opts.onError;
    this.chunkMs = opts.chunkMs;
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (e) {
      this.onError(e instanceof Error ? e : new Error("Failed to access microphone"));
      return false;
    }
    this.mimeType = pickMimeType();
    this.stopped = false;
    this.spawnRecorder();
    return true;
  }

  private spawnRecorder() {
    if (!this.stream || this.stopped) return;
    this.chunks = [];
    const recorder = this.mimeType
      ? new MediaRecorder(this.stream, { mimeType: this.mimeType })
      : new MediaRecorder(this.stream);
    this.recorder = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };

    recorder.onstop = () => {
      const collected = this.chunks;
      this.chunks = [];
      if (collected.length > 0) {
        const blob = new Blob(collected, { type: this.mimeType || "audio/webm" });
        this.onChunk(blob);
      }
      if (!this.stopped) this.spawnRecorder();
    };

    recorder.onerror = (e: Event) => {
      const msg =
        (e as unknown as { error?: { message?: string } }).error?.message ||
        "MediaRecorder error";
      this.onError(new Error(msg));
    };

    try {
      recorder.start();
    } catch (e) {
      this.onError(e instanceof Error ? e : new Error("Failed to start recorder"));
      return;
    }

    this.rotateTimer = setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, this.chunkMs);
  }

  stop() {
    this.stopped = true;
    if (this.rotateTimer) {
      clearTimeout(this.rotateTimer);
      this.rotateTimer = null;
    }
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop();
    }
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop();
      this.stream = null;
    }
    this.recorder = null;
  }
}
