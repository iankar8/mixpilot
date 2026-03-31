// ---------------------------------------------------------------------------
// mixpilot – Tutorial auto-advance hook
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import { useDeckStore } from '../stores/deck-store';
import { useTutorialStore } from './tutorial-store';

/**
 * Watches deck / mixer state and advances the tutorial when conditions are met.
 * Each advance fires with a brief delay so the user sees the "achievement" moment.
 */
export function useTutorialAdvance() {
  const isActive = useTutorialStore((s) => s.isActive);
  const currentStep = useTutorialStore((s) => s.currentStep);
  const stemToggles = useTutorialStore((s) => s.stemToggles);
  const nextStep = useTutorialStore((s) => s.nextStep);

  // Prevent double-advance if conditions stay true across renders
  const advancedRef = useRef(currentStep);

  useEffect(() => {
    if (!isActive) return;
    // Reset guard when step actually changes
    advancedRef.current = currentStep;
  }, [currentStep, isActive]);

  useEffect(() => {
    if (!isActive) return;

    // Step 1 ("Welcome") advances via the "Let's go" button, not auto-detect.
    // Step 10 ("Done") advances via button click.
    // So we only watch steps 2–9 here.

    const unsub = useDeckStore.subscribe((state) => {
      const step = useTutorialStore.getState().currentStep;

      // Already advanced past this step
      if (advancedRef.current !== step) return;

      let shouldAdvance = false;

      switch (step) {
        case 2:
          shouldAdvance = state.deckA.track !== null;
          break;
        case 3:
          shouldAdvance = state.deckA.isPlaying === true;
          break;
        case 4:
          shouldAdvance = state.deckB.track !== null;
          break;
        case 5:
          shouldAdvance = state.deckA.isPlaying && state.deckB.isPlaying;
          break;
        case 6:
          shouldAdvance = state.crossfader !== 0.5;
          break;
        case 7:
          // Any stem differs from all-true
          shouldAdvance =
            !state.deckA.stems.vocals ||
            !state.deckA.stems.drums ||
            !state.deckA.stems.bass ||
            !state.deckA.stems.other ||
            !state.deckB.stems.vocals ||
            !state.deckB.stems.drums ||
            !state.deckB.stems.bass ||
            !state.deckB.stems.other;
          break;
        case 8:
          shouldAdvance = useTutorialStore.getState().stemToggles >= 3;
          break;
        case 9:
          shouldAdvance = state.crossfader > 0.85;
          break;
        default:
          break;
      }

      if (shouldAdvance) {
        advancedRef.current = step + 1;
        // Brief delay for the "nice!" moment
        setTimeout(() => {
          nextStep();
        }, 600);
      }
    });

    return unsub;
  }, [isActive, nextStep, currentStep, stemToggles]);
}
