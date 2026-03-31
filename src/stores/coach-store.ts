import { create } from 'zustand'

// Inline types (types.ts owned by audio agent)
type CoachSuggestion = {
  id: string
  message: string
  action?: () => void
  actionLabel?: string
  type: 'info' | 'warning' | 'success'
  rule: string
  timestamp: number
}

interface CoachState {
  suggestions: CoachSuggestion[]
  enabled: boolean
  addSuggestion: (suggestion: Omit<CoachSuggestion, 'id' | 'timestamp'>) => void
  dismissSuggestion: (id: string) => void
  clearAll: () => void
  setEnabled: (enabled: boolean) => void
}

const MAX_SUGGESTIONS = 2

const TTL: Record<CoachSuggestion['type'], number> = {
  info: 8000,
  warning: 8000,
  success: 3000,
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export const useCoachStore = create<CoachState>((set, get) => ({
  suggestions: [],
  enabled: true,

  addSuggestion: (suggestion) => {
    if (!get().enabled) return

    const id = crypto.randomUUID()
    const timestamp = Date.now()
    const full: CoachSuggestion = { ...suggestion, id, timestamp }
    const ttl = TTL[suggestion.type]

    set((state) => {
      // Newest pushes oldest out when at capacity
      const next = [full, ...state.suggestions].slice(0, MAX_SUGGESTIONS)

      // Clear timers for suggestions that got pushed out
      for (const s of state.suggestions) {
        if (!next.find((n) => n.id === s.id)) {
          const timer = timers.get(s.id)
          if (timer) {
            clearTimeout(timer)
            timers.delete(s.id)
          }
        }
      }

      return { suggestions: next }
    })

    // Auto-remove after TTL
    const timer = setTimeout(() => {
      timers.delete(id)
      set((state) => ({
        suggestions: state.suggestions.filter((s) => s.id !== id),
      }))
    }, ttl)

    timers.set(id, timer)
  },

  dismissSuggestion: (id) => {
    const timer = timers.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.delete(id)
    }
    set((state) => ({
      suggestions: state.suggestions.filter((s) => s.id !== id),
    }))
  },

  clearAll: () => {
    for (const [id, timer] of timers) {
      clearTimeout(timer)
      timers.delete(id)
    }
    set({ suggestions: [] })
  },

  setEnabled: (enabled) => {
    if (!enabled) {
      get().clearAll()
    }
    set({ enabled })
  },
}))
