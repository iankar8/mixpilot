import { checkTimingRules } from './timing'
import { checkClashRules } from './clash'
import { checkPraiseRules, createPraiseHistory } from './praise'
import type { PraiseHistory } from './praise'
import type { DeckId, DeckState, CoachSuggestion } from '../lib/types'

export interface CoachConfig {
  getDeckState: (deckId: DeckId) => DeckState | null
  getCrossfader: () => number
  addSuggestion: (suggestion: Omit<CoachSuggestion, 'id' | 'timestamp'>) => void
  executeAction: (actionName: string, ...args: unknown[]) => void
}

export type CooldownMap = Map<string, number>

const CHECK_INTERVAL_MS = 500

export class CoachEngine {
  private config: CoachConfig
  private cooldowns: CooldownMap = new Map()
  private praiseHistory: PraiseHistory
  private intervalId: ReturnType<typeof setInterval> | null = null

  constructor(config: CoachConfig) {
    this.config = config
    this.praiseHistory = createPraiseHistory()
  }

  start(): void {
    if (this.intervalId !== null) return
    this.intervalId = setInterval(() => this.checkAllRules(), CHECK_INTERVAL_MS)
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  checkAllRules(): void {
    checkPraiseRules(this.config, this.cooldowns, this.praiseHistory)
    checkTimingRules(this.config, this.cooldowns)
    checkClashRules(this.config, this.cooldowns)
  }
}
