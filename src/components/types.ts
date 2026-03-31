// Local UI types — mirrors expected shapes from audio engine.
// The integration agent will reconcile these with src/lib/types.ts later.

export type DeckId = 'A' | 'B';

export interface Track {
  id: string;
  name: string;
  artist: string;
  filename: string;
  bpm?: number;
  key?: string;
  duration?: number;
}

export interface StemState {
  vocals: boolean;
  drums: boolean;
  bass: boolean;
  other: boolean;
}

export type StemName = keyof StemState;

export interface EQState {
  hi: number;   // -12 to 12 dB
  mid: number;
  lo: number;
}

export interface DeckState {
  id: DeckId;
  track: Track | null;
  isPlaying: boolean;
  bpm: number;
  volume: number;       // 0–1
  stems: StemState;
  eq: EQState;
  position: number;     // playback position in seconds
  duration: number;
}

export interface MixerState {
  crossfader: number;   // -1 (full A) to 1 (full B)
  masterVolume: number; // 0–1
}

export interface CoachSuggestion {
  id: string;
  type: 'info' | 'warning' | 'success';
  message: string;
  action?: () => void;
  actionLabel?: string;
}
