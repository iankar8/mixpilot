// ---------------------------------------------------------------------------
// mixpilot – BPM sync utility
// ---------------------------------------------------------------------------
//
// Adjusts playback rates on two decks so they match a shared target BPM.
// ---------------------------------------------------------------------------

import type { Deck } from './deck';

/**
 * Sync both decks to `targetBPM` by adjusting their playback rates.
 *
 * The formula is simple: `rate = targetBPM / originalBPM`.
 * A track at 120 BPM synced to 128 BPM plays at 128/120 = ~1.067x speed.
 *
 * @param deckA     First deck instance.
 * @param deckB     Second deck instance.
 * @param targetBPM The BPM both decks should match.
 * @param bpmA      Original BPM of the track loaded on deck A.
 * @param bpmB      Original BPM of the track loaded on deck B.
 */
export function syncDecks(
  deckA: Deck,
  deckB: Deck,
  targetBPM: number,
  bpmA: number,
  bpmB: number,
): void {
  if (bpmA > 0) {
    deckA.setPlaybackRate(targetBPM / bpmA);
  }
  if (bpmB > 0) {
    deckB.setPlaybackRate(targetBPM / bpmB);
  }
}
