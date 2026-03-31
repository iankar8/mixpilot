import { useEffect, useRef } from 'react';
import { CoachEngine } from '../coach';
import type { CoachConfig } from '../coach';
import { useDeckStore } from '../stores/deck-store';
import { useCoachStore } from '../stores/coach-store';
import { syncDecks } from '../audio/sync';

/**
 * Initializes and manages the CoachEngine lifecycle.
 * Bridges the coach system to the Zustand stores and audio engine.
 */
export function useCoach() {
  const engineRef = useRef<CoachEngine | null>(null);

  useEffect(() => {
    const config: CoachConfig = {
      getDeckState: (deckId) => {
        const state = useDeckStore.getState();
        return deckId === 'A' ? state.deckA : state.deckB;
      },

      getCrossfader: () => {
        return useDeckStore.getState().crossfader;
      },

      addSuggestion: (suggestion) => {
        useCoachStore.getState().addSuggestion(suggestion);
      },

      executeAction: (actionName, ...args) => {
        const store = useDeckStore.getState();

        switch (actionName) {
          case 'setEQ': {
            const [deckId, band, value] = args as ['A' | 'B', 'low' | 'mid' | 'high', number];
            store.setEQ(deckId, band, value);
            break;
          }
          case 'muteStem': {
            const [deckId, stem] = args as ['A' | 'B', 'vocals' | 'drums' | 'bass' | 'other'];
            // Only toggle if stem is currently active (to mute it)
            const deckState = deckId === 'A' ? store.deckA : store.deckB;
            if (deckState.stems[stem]) {
              store.toggleStem(deckId, stem);
            }
            break;
          }
          case 'syncBPM': {
            const bpmA = store.deckA.bpm;
            const bpmB = store.deckB.bpm;
            if (bpmA > 0 && bpmB > 0) {
              const engineA = store.getEngine('A');
              const engineB = store.getEngine('B');
              syncDecks(engineA, engineB, bpmA, bpmA, bpmB);
            }
            break;
          }
          case 'startPlayAndCrossfade': {
            // Start deck B playing and animate crossfader toward B
            store.setDeckPlaying('B', true);
            // Animate crossfader from current to 0.8 over 3 seconds
            const startValue = store.crossfader;
            const targetValue = 0.8;
            const duration = 3000;
            const startTime = Date.now();

            const animateCrossfader = () => {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(1, elapsed / duration);
              // Ease out
              const eased = 1 - Math.pow(1 - progress, 3);
              const value = startValue + (targetValue - startValue) * eased;
              useDeckStore.getState().setCrossfader(value);

              if (progress < 1) {
                requestAnimationFrame(animateCrossfader);
              }
            };
            requestAnimationFrame(animateCrossfader);
            break;
          }
          default:
            console.warn(`[coach] unknown action: ${actionName}`);
        }
      },
    };

    const engine = new CoachEngine(config);
    engineRef.current = engine;
    engine.start();

    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, []);
}
