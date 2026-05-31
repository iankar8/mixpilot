import type {
  MashupAnalysis,
  MashupCandidate,
  MashupScene,
  PreparedRemixTrack,
  RemixTrack,
  Track,
  TrackAnalysis,
} from './types';

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

export interface LibraryAnalysisV2Status extends LibraryAnalysisStatus {
  cachePath: string;
  dependencies?: {
    ok: boolean;
    checks: Array<{ name: string; ok: boolean; version?: string; error?: string }>;
  };
}

export interface MashupCandidateResponse {
  ok: boolean;
  status?: 'ready' | 'analysis-running';
  analyzedCount?: number;
  version?: number;
  source?: string;
  updatedAt?: string | null;
  candidates: MashupCandidate[];
  job?: {
    running: boolean;
    total: number;
    completed: number;
    candidateCount: number;
    error: string | null;
    startedAt: string | null;
    updatedAt: string | null;
    source: string;
  };
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

export async function startLibraryBackgroundAnalysisV2(tracks: Track[]): Promise<LibraryAnalysisV2Status> {
  return postJson<LibraryAnalysisV2Status>('/analyze-library-v2', { tracks }, 8_000);
}

export async function getLibraryAnalysisV2Status(): Promise<LibraryAnalysisV2Status> {
  return getJson<LibraryAnalysisV2Status>('/analysis-v2-status');
}

export async function prepareMashupInbox(tracks: Track[]): Promise<MashupCandidateResponse> {
  return postJson<MashupCandidateResponse>('/prepare-mashup-inbox', { tracks }, 120_000);
}

export async function getMashupCandidates(): Promise<MashupCandidateResponse> {
  return getJson<MashupCandidateResponse>('/mashup-candidates', 8_000);
}

export async function loadCandidateSession(id: string): Promise<MashupCandidate> {
  const response = await postJson<{ ok: true; candidate: MashupCandidate }>(
    '/load-candidate-session',
    { id },
    10_000,
  );
  return response.candidate;
}

export async function getLibraryTracks(artist = 'Drake'): Promise<RemixTrack[]> {
  const params = new URLSearchParams();
  if (artist) params.set('artist', artist);
  const response = await getJson<{ ok: true; tracks: RemixTrack[] }>(
    `/library-tracks?${params.toString()}`,
    10_000,
  );
  return response.tracks;
}

export async function prepareRemixTrack(filename: string, force = false): Promise<PreparedRemixTrack> {
  const response = await postJson<{ ok: true } & PreparedRemixTrack>(
    '/prepare-remix-track',
    { filename, force },
    15 * 60_000,
  );
  return response;
}
