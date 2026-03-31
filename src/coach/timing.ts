import type { CoachConfig, CooldownMap } from './coach'

/**
 * Timing rules: track endings, transitions, and crossfade duration.
 */
export function checkTimingRules(config: CoachConfig, cooldowns: CooldownMap): void {
  const deckA = config.getDeckState('A')
  const deckB = config.getDeckState('B')
  const crossfader = config.getCrossfader()
  const now = Date.now()

  // TRACK_ENDING: Playing deck < 30s remaining, other deck empty
  for (const [deck, other] of [
    [deckA, deckB],
    [deckB, deckA],
  ] as const) {
    if (
      deck?.isPlaying &&
      deck.track &&
      deck.duration > 0 &&
      !other?.track
    ) {
      const remaining = deck.duration - deck.currentTime
      if (remaining < 30 && remaining > 0) {
        if (!isOnCooldown(cooldowns, 'TRACK_ENDING', now, 30_000)) {
          cooldowns.set('TRACK_ENDING', now)
          config.addSuggestion({
            message: 'Track ending soon — load something on the other deck',
            type: 'info',
            rule: 'TRACK_ENDING',
          })
        }
      }
    }
  }

  // TRACK_ENDING_SOON: Playing deck < 60s remaining, other deck loaded
  for (const [deck, other] of [
    [deckA, deckB],
    [deckB, deckA],
  ] as const) {
    if (
      deck?.isPlaying &&
      deck.track &&
      deck.duration > 0 &&
      other?.track &&
      !other.isPlaying
    ) {
      const remaining = deck.duration - deck.currentTime
      if (remaining < 60 && remaining >= 30) {
        if (!isOnCooldown(cooldowns, 'TRACK_ENDING_SOON', now, 60_000)) {
          cooldowns.set('TRACK_ENDING_SOON', now)
          config.addSuggestion({
            message: '~60 seconds left, get ready to transition',
            type: 'info',
            rule: 'TRACK_ENDING_SOON',
          })
        }
      }
    }
  }

  // BRING_IT_IN: Deck A playing > 30s, Deck B loaded but paused
  if (
    deckA?.isPlaying &&
    deckA.track &&
    deckA.currentTime > 30 &&
    deckB?.track &&
    !deckB.isPlaying
  ) {
    if (!isOnCooldown(cooldowns, 'BRING_IT_IN', now, 45_000)) {
      cooldowns.set('BRING_IT_IN', now)
      config.addSuggestion({
        message: 'Ready to bring in Deck B?',
        type: 'info',
        rule: 'BRING_IT_IN',
        action: () => config.executeAction('startPlayAndCrossfade'),
        actionLabel: 'DO IT',
      })
    }
  }

  // LONG_CROSSFADE: Both playing, crossfader mid-range for > 20s
  if (deckA?.isPlaying && deckB?.isPlaying && crossfader >= 0.35 && crossfader <= 0.65) {
    const midStart = cooldowns.get('_CROSSFADE_MID_START')
    if (midStart === undefined) {
      cooldowns.set('_CROSSFADE_MID_START', now)
    } else if (now - midStart > 20_000) {
      if (!isOnCooldown(cooldowns, 'LONG_CROSSFADE', now, 60_000)) {
        cooldowns.set('LONG_CROSSFADE', now)
        config.addSuggestion({
          message: 'Pick a side — commit to a track',
          type: 'info',
          rule: 'LONG_CROSSFADE',
        })
      }
    }
  } else {
    // Reset mid-range tracker when crossfader moves out of range
    cooldowns.delete('_CROSSFADE_MID_START')
  }
}

function isOnCooldown(
  cooldowns: CooldownMap,
  rule: string,
  now: number,
  cooldownMs: number,
): boolean {
  const last = cooldowns.get(rule)
  return last !== undefined && now - last < cooldownMs
}
