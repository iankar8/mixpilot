// ---------------------------------------------------------------------------
// mixpilot – shared types
// ---------------------------------------------------------------------------

/** A single track in the library. */
export interface Track {
  id: string;
  name: string;
  artist: string;
  /** Filename of the MP3 in the library (e.g. 'Ken Carson - Yale.mp3') */
  filename: string;
  bpm?: number;
  key?: string;
  duration?: number;
}

/** The four stem lanes used throughout the app. */
export type StemType = 'vocals' | 'drums' | 'bass' | 'other';

/** Alias used by UI components */
export type StemName = StemType;

/** Canonical ordered list – useful for iteration / UI rendering. */
export const STEM_TYPES = ['vocals', 'drums', 'bass', 'other'] as const;

/** Which side of the mixer. */
export type DeckId = 'A' | 'B';

/** Stem active/muted state */
export type StemState = Record<StemType, boolean>;

/** EQ state – three bands */
export interface EQState {
  low: number;
  mid: number;
  high: number;
}

/** Observable state for a single deck. */
export interface DeckState {
  track: Track | null;
  isPlaying: boolean;
  volume: number;
  /** true = audible, false = muted */
  stems: StemState;
  eq: EQState;
  /** Filter cutoff in Hz (20–20 000). */
  filterFreq: number;
  bpm: number;
  currentTime: number;
  duration: number;
}

/** AI coach suggestion surfaced in the UI. */
export interface CoachSuggestion {
  id: string;
  message: string;
  action?: () => void;
  actionLabel?: string;
  type: 'info' | 'warning' | 'success';
  /** The rule name that triggered this suggestion. */
  rule: string;
  timestamp: number;
}

/** Global mixer state (crossfader + master). */
export interface MixerState {
  crossfader: number;
  masterVolume: number;
}

// ---- Audio serving helpers ----

/** Base path for library audio files served by Vite dev server */
export const LIBRARY_BASE = '/library';

/** Get the URL for a track's full MP3 */
export function getTrackUrl(filename: string): string {
  return `${LIBRARY_BASE}/${encodeURIComponent(filename)}`;
}

/** Get the stem URLs for a track (based on filename without extension) */
export function getStemUrls(filename: string): {
  vocals: string;
  drums: string;
  bass: string;
  other: string;
} {
  const trackName = filename.replace(/\.mp3$/i, '');
  const base = `${LIBRARY_BASE}/stems/${encodeURIComponent(trackName)}`;
  return {
    vocals: `${base}/vocals.mp3`,
    drums: `${base}/drums.mp3`,
    bass: `${base}/bass.mp3`,
    other: `${base}/other.mp3`,
  };
}
