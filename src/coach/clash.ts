import type { CoachConfig, CooldownMap } from './coach'

/**
 * Clash detection rules: bass fights, vocal overlap, BPM mismatch.
 */
export function checkClashRules(config: CoachConfig, cooldowns: CooldownMap): void {
  const deckA = config.getDeckState('A')
  const deckB = config.getDeckState('B')
  const crossfader = config.getCrossfader()
  const now = Date.now()

  // All clash rules require both decks playing
  if (!deckA?.isPlaying || !deckB?.isPlaying) return

  const crossfaderInMix = crossfader >= 0.2 && crossfader <= 0.8

  // BASS_CLASH: Both bass stems active, crossfader in mix range
  if (crossfaderInMix && deckA.stems.bass && deckB.stems.bass) {
    if (!isOnCooldown(cooldowns, 'BASS_CLASH', now, 20_000)) {
      cooldowns.set('BASS_CLASH', now)
      config.addSuggestion({
        message: 'Low ends are fighting — cut bass on Deck A',
        type: 'warning',
        rule: 'BASS_CLASH',
        action: () => config.executeAction('setEQ', 'A', 'low', -24),
        actionLabel: 'DO IT',
      })
    }
  }

  // VOCAL_CLASH: Both vocal stems active
  if (deckA.stems.vocals && deckB.stems.vocals) {
    if (!isOnCooldown(cooldowns, 'VOCAL_CLASH', now, 20_000)) {
      cooldowns.set('VOCAL_CLASH', now)
      config.addSuggestion({
        message: 'Two vocals at once sounds muddy — drop one',
        type: 'warning',
        rule: 'VOCAL_CLASH',
        action: () => config.executeAction('muteStem', 'A', 'vocals'),
        actionLabel: 'DO IT',
      })
    }
  }

  // BPM_MISMATCH: BPMs differ by > 3, crossfader in mix range
  if (crossfaderInMix && Math.abs(deckA.bpm - deckB.bpm) > 3) {
    if (!isOnCooldown(cooldowns, 'BPM_MISMATCH', now, 30_000)) {
      cooldowns.set('BPM_MISMATCH', now)
      config.addSuggestion({
        message: 'BPMs are off — sync up',
        type: 'warning',
        rule: 'BPM_MISMATCH',
        action: () => config.executeAction('syncBPM'),
        actionLabel: 'DO IT',
      })
    }
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
