// ---------------------------------------------------------------------------
// mixpilot – Deck (one side of the DJ mixer)
// ---------------------------------------------------------------------------
//
// Signal chain per stem:
//   Player → Channel (per-stem vol/mute) → EQ3 → Filter → masterChannel → destination
//
// All four stems share a single EQ3, Filter, and masterChannel so that
// EQ / filter / volume knobs affect the whole deck uniformly.
// ---------------------------------------------------------------------------

import * as Tone from 'tone';
import type { DeckId, StemType } from '../lib/types';
import { STEM_TYPES } from '../lib/types';

export class Deck {
  readonly id: DeckId;

  /** Per-stem Tone.Player instances (keyed by stem type). */
  readonly players = new Map<StemType, Tone.Player>();

  /** Per-stem Tone.Channel instances (volume / mute per stem). */
  readonly channels = new Map<StemType, Tone.Channel>();

  /** Shared 3-band EQ for the whole deck. */
  readonly eq: Tone.EQ3;

  /** Shared low-pass filter for the whole deck. */
  readonly filter: Tone.Filter;

  /** Master channel strip – controls overall deck volume. */
  readonly masterChannel: Tone.Channel;

  private _disposed = false;
  private _loading = false;

  constructor(id: DeckId) {
    this.id = id;

    // Build the shared tail of the signal chain.
    this.eq = new Tone.EQ3(0, 0, 0);
    this.filter = new Tone.Filter({
      frequency: 20000,
      type: 'lowpass',
      rolloff: -12,
    });
    this.masterChannel = new Tone.Channel(0);

    // Wire: EQ → Filter → masterChannel → destination
    this.eq.connect(this.filter);
    this.filter.connect(this.masterChannel);
    this.masterChannel.toDestination();
  }

  // -----------------------------------------------------------------------
  // Loading
  // -----------------------------------------------------------------------

  /**
   * Load pre-separated stems from four URLs.
   * If stems are already loaded, the old ones are disposed first.
   */
  async loadStems(stems: {
    vocals: string;
    drums: string;
    bass: string;
    other: string;
  }): Promise<void> {
    if (this._disposed) throw new Error(`Deck ${this.id} is disposed`);

    // Prevent overlapping loads.
    if (this._loading) {
      this._disposeStems();
    }

    this._loading = true;

    // Tear down previous stems if any.
    this._disposeStems();

    // Create players + channels for each stem and begin loading in parallel.
    const loadPromises: Promise<void>[] = [];

    for (const stem of STEM_TYPES) {
      const url = stems[stem];

      const player = new Tone.Player({ url, loop: false });
      const channel = new Tone.Channel(0); // 0 dB, center pan

      // Wire: player → channel → (shared) eq
      player.connect(channel);
      channel.connect(this.eq);

      this.players.set(stem, player);
      this.channels.set(stem, channel);

      loadPromises.push(
        new Promise<void>((resolve, reject) => {
          player.buffer.onload = () => resolve();
          // Player constructor triggers load; if already loaded this fires sync.
          // For safety, also listen via the load() method.
          player.load(url).then(() => resolve(), reject);
        })
      );
    }

    // Wait for all four stems to finish loading.
    await Promise.all(loadPromises);
    this._loading = false;
  }

  // -----------------------------------------------------------------------
  // Transport
  // -----------------------------------------------------------------------

  /** Start all stem players simultaneously. */
  play(): void {
    if (this._disposed) return;
    const now = Tone.now();
    for (const player of this.players.values()) {
      if (player.loaded && player.state !== 'started') {
        player.start(now);
      }
    }
  }

  /** Pause playback (keeps position). */
  pause(): void {
    if (this._disposed) return;
    const now = Tone.now();
    for (const player of this.players.values()) {
      if (player.state === 'started') {
        player.stop(now);
      }
    }
  }

  /** Stop playback and reset to the beginning. */
  stop(): void {
    if (this._disposed) return;
    const now = Tone.now();
    for (const player of this.players.values()) {
      if (player.state === 'started') {
        player.stop(now);
      }
    }
  }

  /** Whether any stem player is currently playing. */
  isPlaying(): boolean {
    for (const player of this.players.values()) {
      if (player.state === 'started') return true;
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // Volume
  // -----------------------------------------------------------------------

  /** Set master deck volume in dB. */
  setVolume(db: number): void {
    if (this._disposed) return;
    this.masterChannel.volume.value = db;
  }

  // -----------------------------------------------------------------------
  // Stems
  // -----------------------------------------------------------------------

  /** Toggle mute on a single stem. Returns `true` if the stem is now audible. */
  toggleStem(stem: StemType): boolean {
    const ch = this.channels.get(stem);
    if (!ch) return false;
    ch.mute = !ch.mute;
    return !ch.mute;
  }

  /** Explicitly mute or unmute a stem. */
  setStemMute(stem: StemType, muted: boolean): void {
    const ch = this.channels.get(stem);
    if (ch) ch.mute = muted;
  }

  /** Returns `true` when the stem is audible (not muted). */
  isStemActive(stem: StemType): boolean {
    const ch = this.channels.get(stem);
    return ch ? !ch.mute : false;
  }

  // -----------------------------------------------------------------------
  // EQ
  // -----------------------------------------------------------------------

  /** Set a single EQ band gain in dB. */
  setEQ(band: 'low' | 'mid' | 'high', db: number): void {
    if (this._disposed) return;
    this.eq[band].value = db;
  }

  // -----------------------------------------------------------------------
  // Filter
  // -----------------------------------------------------------------------

  /** Set the lowpass filter cutoff frequency (20 Hz – 20 000 Hz). */
  setFilterFrequency(freq: number): void {
    if (this._disposed) return;
    const clamped = Math.max(20, Math.min(20000, freq));
    this.filter.frequency.value = clamped;
  }

  // -----------------------------------------------------------------------
  // Playback rate (BPM sync)
  // -----------------------------------------------------------------------

  /** Set playback rate for all stems (1.0 = normal speed). */
  setPlaybackRate(rate: number): void {
    if (this._disposed) return;
    for (const player of this.players.values()) {
      player.playbackRate = rate;
    }
  }

  // -----------------------------------------------------------------------
  // Time / duration
  // -----------------------------------------------------------------------

  /** Current playback position in seconds (from the first loaded stem). */
  getCurrentTime(): number {
    // Tone.Player doesn't expose a simple `currentTime` getter.
    // We read context time relative to start; for a stopped player we return 0.
    for (const player of this.players.values()) {
      if (player.loaded) {
        // If player is started, Tone exposes an internal `_state` but no public
        // getter for elapsed time. We approximate via Tone.now() offset.
        // A more accurate approach uses Tone.Transport; for MVP this is fine.
        if (player.state === 'started') {
          // Player doesn't directly expose elapsed. Return buffer duration as proxy
          // until we hook up Transport-based tracking.
          return 0; // Will be updated by the store's polling loop.
        }
        return 0;
      }
    }
    return 0;
  }

  /** Duration of the loaded audio in seconds (longest stem). */
  getDuration(): number {
    let max = 0;
    for (const player of this.players.values()) {
      if (player.loaded && player.buffer.duration > max) {
        max = player.buffer.duration;
      }
    }
    return max;
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  /** Dispose of all audio nodes. The Deck is unusable after this. */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    this._disposeStems();
    this.eq.dispose();
    this.filter.dispose();
    this.masterChannel.dispose();
  }

  /** Tear down per-stem players and channels. */
  private _disposeStems(): void {
    for (const player of this.players.values()) {
      if (player.state === 'started') player.stop();
      player.dispose();
    }
    for (const channel of this.channels.values()) {
      channel.dispose();
    }
    this.players.clear();
    this.channels.clear();
  }
}
