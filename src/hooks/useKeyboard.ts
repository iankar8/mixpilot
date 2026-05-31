import { useEffect } from 'react';
import { useDeckStore } from '../stores/deck-store';
import { initAudio } from '../audio/engine';
import type { MashupScene } from '../lib/types';

function unlockAudio() {
  void initAudio().catch((err) => {
    console.warn('[mixmash] Audio unlock deferred until the next gesture', err);
  });
}

interface KeyboardHandlers {
  onOpenSearch?: () => void;
  onSync?: () => void;
  scenes?: MashupScene[];
  onApplyScene?: (scene: MashupScene) => void;
}

/** Keyboard shortcut handler for the mashup instrument. */
export function useKeyboard({
  onOpenSearch,
  onSync,
  scenes = [],
  onApplyScene,
}: KeyboardHandlers = {}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't fire shortcuts when typing in text inputs, but allow for range sliders
      const target = e.target as HTMLInputElement;
      const isTextInput =
        (target.tagName === 'INPUT' && target.type !== 'range') ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      if (isTextInput) {
        return;
      }

      const store = useDeckStore.getState();
      const key = e.key;

      if ((e.metaKey || e.ctrlKey) && key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenSearch?.();
        return;
      }

      if (key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onOpenSearch?.();
        return;
      }

      if (/^[1-4]$/.test(key)) {
        const scene = scenes[Number(key) - 1];
        if (scene && onApplyScene) {
          e.preventDefault();
          onApplyScene(scene);
          return;
        }
      }

      switch (key) {
        case ' ': {
          e.preventDefault();
          if (!store.deckA.isPlaying && (!store.deckA.track || store.deckA.duration <= 0)) return;
          unlockAudio();
          const isPlaying = store.deckA.isPlaying;
          store.setDeckPlaying('A', !isPlaying);
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (!store.deckB.isPlaying && (!store.deckB.track || store.deckB.duration <= 0)) return;
          unlockAudio();
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
          onSync?.();
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
  }, [onApplyScene, onOpenSearch, onSync, scenes]);
}
