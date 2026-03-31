// ---------------------------------------------------------------------------
// mixpilot – audio engine (Tone.js bootstrap)
// ---------------------------------------------------------------------------
//
// Web Audio API requires a user gesture before audio can play.
// Call `initAudio()` from a click / keypress handler; after that
// `isAudioReady()` returns true and all Deck operations will work.
// ---------------------------------------------------------------------------

import * as Tone from 'tone';

let _ready = false;

/**
 * Start the Tone.js audio context.
 * Must be called from a user-gesture event handler (click, keydown, etc.).
 * Safe to call multiple times – subsequent calls are no-ops.
 */
export async function initAudio(): Promise<void> {
  if (_ready) return;

  await Tone.start();
  _ready = true;

  console.log('[mixpilot] audio context started –', Tone.getContext().state);
}

/** Whether the audio context has been unlocked by a user gesture. */
export function isAudioReady(): boolean {
  return _ready;
}
