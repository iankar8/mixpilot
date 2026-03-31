import { useEffect } from 'react';
import { useDeckStore } from '../stores/deck-store';

/** Keyboard shortcut handler for the DJ app. */
export function useKeyboard() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't fire shortcuts when typing in the search input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const store = useDeckStore.getState();
      const key = e.key;

      switch (key) {
        case ' ': {
          e.preventDefault();
          const isPlaying = store.deckA.isPlaying;
          store.setDeckPlaying('A', !isPlaying);
          break;
        }
        case 'Enter': {
          e.preventDefault();
          const isPlaying = store.deckB.isPlaying;
          store.setDeckPlaying('B', !isPlaying);
          break;
        }

        // Stem toggles Deck A
        case 'q':
        case 'Q':
          e.preventDefault();
          store.toggleStem('A', 'vocals');
          break;
        case 'w':
        case 'W':
          e.preventDefault();
          store.toggleStem('A', 'drums');
          break;
        case 'e':
        case 'E':
          e.preventDefault();
          store.toggleStem('A', 'bass');
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          store.toggleStem('A', 'other');
          break;

        // Stem toggles Deck B
        case 'u':
        case 'U':
          e.preventDefault();
          store.toggleStem('B', 'vocals');
          break;
        case 'i':
        case 'I':
          e.preventDefault();
          store.toggleStem('B', 'drums');
          break;
        case 'o':
        case 'O':
          e.preventDefault();
          store.toggleStem('B', 'bass');
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          store.toggleStem('B', 'other');
          break;

        // Crossfader
        case 'ArrowLeft':
          e.preventDefault();
          store.setCrossfader(Math.max(0, store.crossfader - 0.05));
          break;
        case 'ArrowRight':
          e.preventDefault();
          store.setCrossfader(Math.min(1, store.crossfader + 0.05));
          break;

        // Sync BPM
        case 'Tab': {
          e.preventDefault();
          // Sync deck B to deck A's BPM
          const bpmA = store.deckA.bpm;
          const bpmB = store.deckB.bpm;
          if (bpmA > 0 && bpmB > 0) {
            const engineA = store.getEngine('A');
            const engineB = store.getEngine('B');
            const targetBPM = bpmA;
            engineA.setPlaybackRate(targetBPM / bpmA);
            engineB.setPlaybackRate(targetBPM / bpmB);
          }
          break;
        }

        // Stop all
        case 'Escape':
          e.preventDefault();
          store.setDeckPlaying('A', false);
          store.setDeckPlaying('B', false);
          break;

        default:
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
