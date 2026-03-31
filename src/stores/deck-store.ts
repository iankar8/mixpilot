// ---------------------------------------------------------------------------
// mixpilot – Zustand store (decks + mixer)
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import type { DeckId, DeckState, StemType, Track } from '../lib/types';
import { Deck } from '../audio/deck';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultDeckState(): DeckState {
  return {
    track: null,
    isPlaying: false,
    volume: 0.8,
    stems: { vocals: true, drums: true, bass: true, other: true },
    eq: { low: 0, mid: 0, high: 0 },
    filterFreq: 20000,
    bpm: 0,
    currentTime: 0,
    duration: 0,
  };
}

/** Convert a linear 0-1 volume to dB (clamped to -Infinity at 0). */
function linearToDb(v: number): number {
  if (v <= 0) return -Infinity;
  return 20 * Math.log10(v);
}

// ---------------------------------------------------------------------------
// Store types
// ---------------------------------------------------------------------------

interface DeckStoreState {
  deckA: DeckState;
  deckB: DeckState;

  /** 0 = full deck A, 0.5 = center, 1 = full deck B */
  crossfader: number;
  masterVolume: number;

  // --- actions ---
  setDeckTrack: (deckId: DeckId, track: Track) => void;
  setDeckPlaying: (deckId: DeckId, playing: boolean) => void;
  toggleStem: (deckId: DeckId, stem: StemType) => void;
  setVolume: (deckId: DeckId, volume: number) => void;
  setEQ: (deckId: DeckId, band: 'low' | 'mid' | 'high', value: number) => void;
  setFilter: (deckId: DeckId, freq: number) => void;
  setCrossfader: (value: number) => void;
  setBPM: (deckId: DeckId, bpm: number) => void;
  setCurrentTime: (deckId: DeckId, time: number) => void;

  /** Access the audio engine instances. Not serializable – treat as refs. */
  getEngine: (deckId: DeckId) => Deck;
}

// ---------------------------------------------------------------------------
// Audio engine singletons (outside React render tree)
// ---------------------------------------------------------------------------

const engineA = new Deck('A');
const engineB = new Deck('B');

function getEngine(id: DeckId): Deck {
  return id === 'A' ? engineA : engineB;
}

/** Helper to resolve the state key for a deck. */
function deckKey(id: DeckId): 'deckA' | 'deckB' {
  return id === 'A' ? 'deckA' : 'deckB';
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useDeckStore = create<DeckStoreState>()((set, get) => ({
  deckA: defaultDeckState(),
  deckB: defaultDeckState(),
  crossfader: 0.5,
  masterVolume: 1,

  getEngine,

  // -----------------------------------------------------------------------
  // Track loading
  // -----------------------------------------------------------------------

  setDeckTrack: (deckId, track) => {
    const key = deckKey(deckId);
    set((s) => ({
      [key]: {
        ...s[key],
        track,
        bpm: track.bpm ?? 0,
        duration: track.duration ?? 0,
        currentTime: 0,
        isPlaying: false,
        stems: { vocals: true, drums: true, bass: true, other: true },
      },
    }));
  },

  // -----------------------------------------------------------------------
  // Transport
  // -----------------------------------------------------------------------

  setDeckPlaying: (deckId, playing) => {
    const key = deckKey(deckId);
    const engine = getEngine(deckId);

    if (playing) {
      engine.play();
    } else {
      engine.pause();
    }

    set((s) => ({
      [key]: { ...s[key], isPlaying: playing },
    }));
  },

  // -----------------------------------------------------------------------
  // Stems
  // -----------------------------------------------------------------------

  toggleStem: (deckId, stem) => {
    const key = deckKey(deckId);
    const engine = getEngine(deckId);
    const nowActive = engine.toggleStem(stem);

    set((s) => ({
      [key]: {
        ...s[key],
        stems: { ...s[key].stems, [stem]: nowActive },
      },
    }));
  },

  // -----------------------------------------------------------------------
  // Volume
  // -----------------------------------------------------------------------

  setVolume: (deckId, volume) => {
    const key = deckKey(deckId);
    const engine = getEngine(deckId);
    engine.setVolume(linearToDb(volume));

    set((s) => ({
      [key]: { ...s[key], volume },
    }));
  },

  // -----------------------------------------------------------------------
  // EQ
  // -----------------------------------------------------------------------

  setEQ: (deckId, band, value) => {
    const key = deckKey(deckId);
    const engine = getEngine(deckId);
    engine.setEQ(band, value);

    set((s) => ({
      [key]: {
        ...s[key],
        eq: { ...s[key].eq, [band]: value },
      },
    }));
  },

  // -----------------------------------------------------------------------
  // Filter
  // -----------------------------------------------------------------------

  setFilter: (deckId, freq) => {
    const key = deckKey(deckId);
    const engine = getEngine(deckId);
    engine.setFilterFrequency(freq);

    set((s) => ({
      [key]: { ...s[key], filterFreq: freq },
    }));
  },

  // -----------------------------------------------------------------------
  // Crossfader
  // -----------------------------------------------------------------------

  setCrossfader: (value) => {
    const eA = getEngine('A');
    const eB = getEngine('B');

    // Equal-power-ish crossfade: A vol = 1 - crossfader, B vol = crossfader
    eA.setVolume(linearToDb((1 - value) * get().deckA.volume));
    eB.setVolume(linearToDb(value * get().deckB.volume));

    set({ crossfader: value });
  },

  // -----------------------------------------------------------------------
  // BPM
  // -----------------------------------------------------------------------

  setBPM: (deckId, bpm) => {
    const key = deckKey(deckId);
    set((s) => ({
      [key]: { ...s[key], bpm },
    }));
  },

  // -----------------------------------------------------------------------
  // Playback position (set by a polling loop in the UI layer)
  // -----------------------------------------------------------------------

  setCurrentTime: (deckId, time) => {
    const key = deckKey(deckId);
    set((s) => ({
      [key]: { ...s[key], currentTime: time },
    }));
  },
}));
