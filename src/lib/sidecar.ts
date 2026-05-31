import type { MashupAnalysis, MashupScene, Track, TrackAnalysis } from './types';

const SIDECAR_BASE = import.meta.env.VITE_MIXMASH_SIDECAR_URL || 'http://127.0.0.1:8787';

export type SceneStatus = 'fallback' | 'loading' | 'model' | 'offline' | 'error';

export interface LibraryAnalysisStatus {
  ok: boolean;
  running: boolean;
  total: number;
  completed: number;
  cacheCount: number;
  lastTrack: string | null;
  error: string | null;
}

async function postJson<T>(path: string, body: unknown, timeoutMs = 30_000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${SIDECAR_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await response.json();
    if (!response.ok || json.ok === false) {
      throw new Error(json.error || `Sidecar request failed: ${response.status}`);
    }
    return json as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function getJson<T>(path: string, timeoutMs = 5_000): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${SIDECAR_BASE}${path}`, { signal: controller.signal });
    const json = await response.json();
    if (!response.ok || json.ok === false) {
      throw new Error(json.error || `Sidecar request failed: ${response.status}`);
    }
    return json as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function suggestScenesWithSidecar(payload: {
  trackA: Track;
  trackB: Track;
  analysisA: TrackAnalysis;
  analysisB: TrackAnalysis;
  mashup: MashupAnalysis;
}): Promise<MashupScene[]> {
  const response = await postJson<{ ok: true; scenes: MashupScene[] }>(
    '/suggest-scenes',
    payload,
    120_000,
  );
  return response.scenes;
}

export async function startLibraryBackgroundAnalysis(tracks: Track[]): Promise<LibraryAnalysisStatus> {
  return postJson<LibraryAnalysisStatus>('/analyze-library', { tracks }, 8_000);
}

export async function getLibraryAnalysisStatus(): Promise<LibraryAnalysisStatus> {
  return getJson<LibraryAnalysisStatus>('/analysis-status');
}
