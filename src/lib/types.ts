// ---------------------------------------------------------------------------
// mixpilot – shared types
// ---------------------------------------------------------------------------

/** A single track in the library. */
export interface Track {
  id: string;
  name: string;
  artist: string;
  /** Relative URL path the dev server can resolve (e.g. /dj-library/song.mp3) */
  path: string;
  bpm?: number;
  key?: string;
  duration?: number;
  /** Pre-separated stem URLs – all four must be present when stems exist. */
  stemsPath?: {
    vocals: string;
    drums: string;
    bass: string;
    other: string;
  };
}

/** The four stem lanes used throughout the app. */
export type StemType = 'vocals' | 'drums' | 'bass' | 'other';

/** Canonical ordered list – useful for iteration / UI rendering. */
export const STEM_TYPES = ['vocals', 'drums', 'bass', 'other'] as const;

/** Which side of the mixer. */
export type DeckId = 'A' | 'B';

/** Observable state for a single deck. */
export interface DeckState {
  track: Track | null;
  isPlaying: boolean;
  volume: number;
  /** true = audible, false = muted */
  stems: Record<StemType, boolean>;
  eq: { low: number; mid: number; high: number };
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
