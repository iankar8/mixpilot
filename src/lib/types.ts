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
  /** Current playback-rate multiplier applied to loaded audio. */
  playbackRate: number;
  currentTime: number;
  duration: number;
  /** Normalized waveform peak amplitudes (0–1), extracted from loaded stems. */
  peaks: number[];
}

/** Cached browser-side analysis for one loaded track. */
export interface TrackAnalysis {
  trackId: string;
  bpm: number;
  duration: number;
  beatPeriod: number;
  downbeats: number[];
  phrases: number[];
  stemAvailability: Record<StemType, boolean>;
  confidence: number;
  source: 'estimate' | 'cached-browser' | 'sidecar-background' | 'python-numpy-v2';
  analyzedAt: number;
}

export interface EnergyWindow {
  start: number;
  end: number;
  score: number;
}

export interface SectionCandidate {
  id: string;
  label: 'intro' | 'phrase' | 'hook' | 'drop' | 'breakdown';
  start: number;
  end: number;
  score: number;
  vocalEnergy: number;
  drumEnergy: number;
  bassEnergy: number;
}

export interface TrackAnalysisV2 {
  version: 2;
  trackId: string;
  name: string;
  artist: string;
  filename: string;
  duration: number;
  bpm: {
    provided: number | null;
    detected: number | null;
    resolved: number;
    confidence: number;
    source: string;
  };
  beatPeriod: number;
  downbeatOffset: number;
  beatgrid: number[];
  downbeats: number[];
  phrases: number[];
  stemAvailability: Record<StemType, boolean>;
  stemEnergy: Record<StemType, {
    mean: number;
    peak: number;
    activity: number;
    windows: EnergyWindow[];
  }>;
  vocalWindows: EnergyWindow[];
  bassWindows: EnergyWindow[];
  drumWindows: EnergyWindow[];
  sectionCandidates: SectionCandidate[];
  hookCandidates: SectionCandidate[];
  dropCandidates: SectionCandidate[];
  roughKey: {
    key: string | null;
    scale: string | null;
    confidence: number;
    chroma: number[];
  };
  confidence: number;
  warnings: string[];
  source: string;
  fileMtimeMs: number;
  analyzedAt: number;
}

/** Pair-level analysis used to lock two tracks into a mashup. */
export interface MashupAnalysis {
  id: string;
  status: 'idle' | 'analyzing' | 'ready' | 'synced' | 'warning';
  targetBpm: number;
  deckARate: number;
  deckBRate: number;
  deckBSeek: number;
  phaseOffsetSeconds: number;
  phraseOffsetBeats: number;
  confidence: number;
  warnings: string[];
}

export interface PairAnalysis {
  id: string;
  targetBpm: number;
  deckARate: number;
  deckBRate: number;
  deckAStart: number;
  deckBStart: number;
  durationBars: number;
  confidence: number;
  phraseMatch: number;
  bassClashRisk: number;
  vocalOverlapRisk: number;
  harmonicRisk: number;
}

export interface SceneAutomationEvent {
  id: string;
  atBar: number;
  deck?: DeckId;
  action: 'setStem' | 'setCrossfader' | 'triggerPad';
  stem?: StemType;
  active?: boolean;
  value?: number;
}

/** A human-triggerable mashup scene generated from the current pair. */
export interface MashupScene {
  id: string;
  name: string;
  description: string;
  keyHint: string;
  deckAStems: StemState;
  deckBStems: StemState;
  crossfader: number;
  transition: 'cut' | 'fade';
  startOffsets?: Record<DeckId, number>;
  playbackRates?: Record<DeckId, number>;
  durationBars?: number;
  fadeBars?: number;
  events?: SceneAutomationEvent[];
}

export interface MashupCandidate {
  id: string;
  title: string;
  subtitle: string;
  rationale: string;
  tags: string[];
  score: number;
  scoreBreakdown: {
    confidence: number;
    stemQuality: number;
    phraseScore: number;
    bassRisk: number;
    vocalRisk: number;
    harmonicRisk: number;
  };
  trackA: Track;
  trackB: Track;
  analysisA: TrackAnalysisV2;
  analysisB: TrackAnalysisV2;
  pair: PairAnalysis;
  scenes: MashupScene[];
  warnings: string[];
  source: string;
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
