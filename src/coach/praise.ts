import type { CoachConfig, CooldownMap } from './coach'

export interface PraiseHistory {
  /** Ring buffer of recent crossfader positions with timestamps */
  crossfaderSamples: Array<{ value: number; time: number }>
  /** Number of stem toggles this session */
  stemTogglesCount: number
  /** Previous stem states for detecting toggles */
  prevStems: {
    A: Record<string, boolean> | null
    B: Record<string, boolean> | null
  }
  /** Whether first simultaneous mix has been detected */
  firstMixDetected: boolean
  /** Whether session start message has been shown */
  sessionStartShown: boolean
}

export function createPraiseHistory(): PraiseHistory {
  return {
    crossfaderSamples: [],
    stemTogglesCount: 0,
    prevStems: { A: null, B: null },
    firstMixDetected: false,
    sessionStartShown: false,
  }
}

const MAX_CROSSFADER_SAMPLES = 60 // ~30s at 500ms intervals

/**
 * Praise rules: positive reinforcement for good DJ moves.
 */
export function checkPraiseRules(
  config: CoachConfig,
  cooldowns: CooldownMap,
  history: PraiseHistory,
): void {
  const deckA = config.getDeckState('A')
  const deckB = config.getDeckState('B')
  const crossfader = config.getCrossfader()
  const now = Date.now()
  const bothPlaying = deckA?.isPlaying && deckB?.isPlaying

  // SESSION_START: First check ever
  if (!history.sessionStartShown) {
    history.sessionStartShown = true
    config.addSuggestion({
      message: 'Load tracks to get started',
      type: 'info',
      rule: 'SESSION_START',
    })
    return // Don't fire other rules on first check
  }

  // Track crossfader for transition detection
  history.crossfaderSamples.push({ value: crossfader, time: now })
  if (history.crossfaderSamples.length > MAX_CROSSFADER_SAMPLES) {
    history.crossfaderSamples.shift()
  }

  // Detect stem toggles
  if (bothPlaying) {
    for (const deckId of ['A', 'B'] as const) {
      const deck = deckId === 'A' ? deckA : deckB
      if (!deck) continue
      const prev = history.prevStems[deckId]
      if (prev) {
        for (const stem of Object.keys(deck.stems) as Array<keyof typeof deck.stems>) {
          if (prev[stem] !== undefined && prev[stem] !== deck.stems[stem]) {
            history.stemTogglesCount++

            // STEM_TRICK: Toggled a stem while both decks playing
            if (!isOnCooldown(cooldowns, 'STEM_TRICK', now, 15_000)) {
              cooldowns.set('STEM_TRICK', now)
              config.addSuggestion({
                message: 'Nice stem work',
                type: 'success',
                rule: 'STEM_TRICK',
              })
            }
          }
        }
      }
      history.prevStems[deckId] = { ...deck.stems }
    }
  }

  // FIRST_MIX: Both decks playing for the first time
  if (bothPlaying && !history.firstMixDetected) {
    history.firstMixDetected = true
    config.addSuggestion({
      message: "First blend! You're mixing",
      type: 'success',
      rule: 'FIRST_MIX',
    })
  }

  // CLEAN_TRANSITION: Crossfader moved from <0.15 to >0.85 over 3-12 seconds
  if (!isOnCooldown(cooldowns, 'CLEAN_TRANSITION', now, 30_000)) {
    const samples = history.crossfaderSamples
    if (samples.length >= 6) {
      // Look for a transition in recent samples
      const recentWindow = samples.filter((s) => now - s.time <= 15_000)
      if (recentWindow.length >= 6) {
        const firstLow = recentWindow.findIndex((s) => s.value < 0.15)
        if (firstLow !== -1) {
          const afterLow = recentWindow.slice(firstLow)
          const firstHigh = afterLow.findIndex((s) => s.value > 0.85)
          if (firstHigh !== -1) {
            const duration = afterLow[firstHigh].time - afterLow[0].time
            if (duration >= 3000 && duration <= 12_000) {
              // Verify it was smooth (monotonically increasing, roughly)
              const transitionSamples = afterLow.slice(0, firstHigh + 1)
              let isSmooth = true
              for (let i = 1; i < transitionSamples.length; i++) {
                if (transitionSamples[i].value < transitionSamples[i - 1].value - 0.05) {
                  isSmooth = false
                  break
                }
              }
              if (isSmooth) {
                cooldowns.set('CLEAN_TRANSITION', now)
                config.addSuggestion({
                  message: 'Clean transition',
                  type: 'success',
                  rule: 'CLEAN_TRANSITION',
                })
                // Clear samples after detecting to avoid re-triggering
                history.crossfaderSamples = []
              }
            }
          }
        }
      }
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
