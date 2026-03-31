import { useCallback, useRef } from 'react';
import Library from './components/Library';
import DeckView from './components/DeckView';
import Mixer from './components/Mixer';
import CoachOverlay from './components/CoachOverlay';
import KeyboardHints from './components/KeyboardHints';
import { useDeckStore } from './stores/deck-store';
import { useKeyboard } from './hooks/useKeyboard';
import { useCoach } from './hooks/useCoach';
import { initAudio } from './audio/engine';
import { syncDecks } from './audio/sync';
import type { Track, DeckId } from './lib/types';
import { getTrackUrl, getStemUrls } from './lib/types';

export default function App() {
  const audioInitRef = useRef(false);

  // Zustand store
  const deckA = useDeckStore((s) => s.deckA);
  const deckB = useDeckStore((s) => s.deckB);
  const crossfader = useDeckStore((s) => s.crossfader);
  const masterVolume = useDeckStore((s) => s.masterVolume);
  const setDeckTrack = useDeckStore((s) => s.setDeckTrack);
  const setDeckPlaying = useDeckStore((s) => s.setDeckPlaying);
  const toggleStem = useDeckStore((s) => s.toggleStem);
  const setVolume = useDeckStore((s) => s.setVolume);
  const setEQ = useDeckStore((s) => s.setEQ);
  const setCrossfader = useDeckStore((s) => s.setCrossfader);
  const getEngine = useDeckStore((s) => s.getEngine);

  // Initialize keyboard shortcuts
  useKeyboard();

  // Initialize coach engine
  useCoach();

  // Ensure audio context is started on first user interaction
  const ensureAudio = useCallback(async () => {
    if (!audioInitRef.current) {
      await initAudio();
      audioInitRef.current = true;
    }
  }, []);

  // Handle track loading from library
  const handleLoadTrack = useCallback(
    async (track: Track, targetDeck: DeckId) => {
      await ensureAudio();

      // Set track on store
      setDeckTrack(targetDeck, track);

      // Load stems into audio engine
      const engine = getEngine(targetDeck);
      const stemUrls = getStemUrls(track.filename);

      try {
        // Try loading stems first
        await engine.loadStems(stemUrls);
        console.log(`[mixpilot] Loaded stems for ${track.name} on Deck ${targetDeck}`);
      } catch (err) {
        console.warn(`[mixpilot] Stems not available for ${track.name}, loading full track`, err);
        // Fallback: load the full track as all four stem slots
        const fullUrl = getTrackUrl(track.filename);
        try {
          await engine.loadStems({
            vocals: fullUrl,
            drums: fullUrl,
            bass: fullUrl,
            other: fullUrl,
          });
          console.log(`[mixpilot] Loaded full track for ${track.name} on Deck ${targetDeck}`);
        } catch (fallbackErr) {
          console.error(`[mixpilot] Failed to load track ${track.name}`, fallbackErr);
        }
      }
    },
    [ensureAudio, setDeckTrack, getEngine],
  );

  const handlePlayPause = useCallback(
    async (id: DeckId) => {
      await ensureAudio();
      const state = useDeckStore.getState();
      const deck = id === 'A' ? state.deckA : state.deckB;
      setDeckPlaying(id, !deck.isPlaying);
    },
    [ensureAudio, setDeckPlaying],
  );

  const handleSync = useCallback(async () => {
    await ensureAudio();
    const state = useDeckStore.getState();
    const bpmA = state.deckA.bpm;
    const bpmB = state.deckB.bpm;
    if (bpmA > 0 && bpmB > 0) {
      const engineA = getEngine('A');
      const engineB = getEngine('B');
      syncDecks(engineA, engineB, bpmA, bpmA, bpmB);
    }
  }, [ensureAudio, getEngine]);

  const trackUrlA = deckA.track ? getTrackUrl(deckA.track.filename) : undefined;
  const trackUrlB = deckB.track ? getTrackUrl(deckB.track.filename) : undefined;

  return (
    <div
      onClick={ensureAudio}
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background: 'var(--bg-base)',
      }}
    >
      {/* Left sidebar: Library */}
      <Library
        onLoadTrack={handleLoadTrack}
        deckALoaded={deckA.track !== null}
        deckBLoaded={deckB.track !== null}
      />

      {/* Main area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 16px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              letterSpacing: '0.15em',
              textTransform: 'lowercase',
            }}
          >
            mixpilot
          </span>
        </div>

        {/* Decks + Mixer */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            gap: '12px',
            padding: '12px',
            alignItems: 'stretch',
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          {/* Deck A */}
          <DeckView
            deckId="A"
            state={deckA}
            trackUrl={trackUrlA}
            onPlayPause={() => handlePlayPause('A')}
            onStemToggle={(stem) => toggleStem('A', stem)}
            onVolumeChange={(v) => setVolume('A', v)}
            onEQChange={(band, val) => setEQ('A', band, val)}
          />

          {/* Mixer */}
          <Mixer
            crossfader={crossfader}
            masterVolume={masterVolume}
            bpmA={deckA.bpm}
            bpmB={deckB.bpm}
            onCrossfaderChange={setCrossfader}
            onMasterVolumeChange={(v) => {
              // Update master volume (could be wired to a global gain)
              useDeckStore.setState({ masterVolume: v });
            }}
            onSync={handleSync}
          />

          {/* Deck B */}
          <DeckView
            deckId="B"
            state={deckB}
            trackUrl={trackUrlB}
            onPlayPause={() => handlePlayPause('B')}
            onStemToggle={(stem) => toggleStem('B', stem)}
            onVolumeChange={(v) => setVolume('B', v)}
            onEQChange={(band, val) => setEQ('B', band, val)}
          />
        </div>
      </div>

      {/* Floating overlays */}
      <CoachOverlay />
      <KeyboardHints />
    </div>
  );
}
