import { useCallback, useEffect, useRef } from 'react';
import Library from './components/Library';
import DeckView from './components/DeckView';
import Mixer from './components/Mixer';
import AIPanel from './components/AIPanel';
import KeyboardHints from './components/KeyboardHints';
import TutorialOverlay from './components/TutorialOverlay';
import { useDeckStore } from './stores/deck-store';
import { useKeyboard } from './hooks/useKeyboard';
import { useCoach } from './hooks/useCoach';
import { useTutorialAdvance } from './tutorial/tutorial-hooks';
import { useTutorialStore } from './tutorial/tutorial-store';
import { useCoachStore } from './stores/coach-store';
import { initAudio } from './audio/engine';
import { syncDecks } from './audio/sync';
import type { Track, DeckId } from './lib/types';
import { getTrackUrl, getStemUrls } from './lib/types';
import { BPM_ESTIMATES } from './lib/recommendations';

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
  const seekDeck = useDeckStore((s) => s.seekDeck);
  const setBPM = useDeckStore((s) => s.setBPM);

  // Initialize keyboard shortcuts
  useKeyboard();

  // Initialize coach engine
  useCoach();

  // Tutorial auto-advance watcher
  useTutorialAdvance();

  // Track stem toggles for tutorial step 8
  const tutorialIsActive = useTutorialStore((s) => s.isActive);
  const tutorialStep = useTutorialStore((s) => s.currentStep);
  const incrementStemToggles = useTutorialStore((s) => s.incrementStemToggles);
  const stemToggleTrackerRef = useRef(false);

  useEffect(() => {
    if (!tutorialIsActive || (tutorialStep !== 7 && tutorialStep !== 8)) return;

    const unsub = useDeckStore.subscribe((_state, prevState) => {
      const state = useDeckStore.getState();
      // Check if any stem toggled between prev and current
      const stemsA = state.deckA.stems;
      const stemsB = state.deckB.stems;
      const prevA = prevState.deckA.stems;
      const prevB = prevState.deckB.stems;

      const changed =
        stemsA.vocals !== prevA.vocals ||
        stemsA.drums !== prevA.drums ||
        stemsA.bass !== prevA.bass ||
        stemsA.other !== prevA.other ||
        stemsB.vocals !== prevB.vocals ||
        stemsB.drums !== prevB.drums ||
        stemsB.bass !== prevB.bass ||
        stemsB.other !== prevB.other;

      if (changed) {
        incrementStemToggles();
      }
    });

    return unsub;
  }, [tutorialIsActive, tutorialStep, incrementStemToggles]);

  // Auto-start tutorial on first load if not completed
  useEffect(() => {
    const tutState = useTutorialStore.getState();
    if (!tutState.completed && !tutState.isActive) {
      tutState.startTutorial();
    }
  }, []);

  // Suppress coach during tutorial
  useEffect(() => {
    if (tutorialIsActive) {
      useCoachStore.getState().setEnabled(false);
    } else {
      // Re-enable coach after tutorial ends
      if (!stemToggleTrackerRef.current) {
        stemToggleTrackerRef.current = true;
      } else {
        useCoachStore.getState().setEnabled(true);
      }
    }
  }, [tutorialIsActive]);

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

      // Set track on store (BPM from track or estimates)
      const bpm = track.bpm ?? BPM_ESTIMATES[track.artist] ?? 128;
      setDeckTrack(targetDeck, { ...track, bpm });

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

      // Set duration and extract waveform peaks from drums stem
      const duration = engine.getDuration();
      const peaks = engine.getPeaks('drums', 500);
      const deckKey = targetDeck === 'A' ? 'deckA' : 'deckB';
      useDeckStore.setState((s) => ({
        [deckKey]: { ...s[deckKey], duration, bpm, peaks },
      }));
    },
    [ensureAudio, setDeckTrack, getEngine],
  );

  // Poll playback time every 100ms and update waveform cursor
  useEffect(() => {
    const interval = setInterval(() => {
      const state = useDeckStore.getState();
      if (state.deckA.isPlaying) {
        state.setCurrentTime('A', state.getEngine('A').getCurrentTime());
      }
      if (state.deckB.isPlaying) {
        state.setCurrentTime('B', state.getEngine('B').getCurrentTime());
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

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

      // 1. Match tempo: adjust Deck B's rate so it plays at bpmA
      syncDecks(engineA, engineB, bpmA, bpmA, bpmB);

      // 2. Beat phase snap: seek Deck B so its beats align with Deck A's current beat
      const beatPeriodA = 60 / bpmA; // seconds per beat at target BPM
      const phaseA = engineA.getCurrentTime() % beatPeriodA; // A's position within current beat

      // Deck B's file has bpmB BPM, but after rate adjust it plays at bpmA.
      // To put Deck B at the same beat phase, we seek it in its original timescale.
      const beatPeriodB_original = 60 / bpmB; // beat period in B's original file
      const currentB = engineB.getCurrentTime();
      const currentBeatB = Math.floor(currentB / beatPeriodB_original);
      // Target: find the beat boundary in B's original time closest to keeping B near its current position
      const phaseB_target = phaseA * (bpmB / bpmA); // same phase in B's original timescale
      const seekB = currentBeatB * beatPeriodB_original + phaseB_target;
      engineB.seek(Math.max(0, seekB));

      // 3. Update Deck B's displayed BPM to the target
      useDeckStore.setState((s) => ({
        deckB: { ...s.deckB, bpm: bpmA },
      }));

      console.log(`[mixpilot] SYNC: B ${bpmB}→${bpmA} BPM (rate=${(bpmA / bpmB).toFixed(3)}, seekB=${seekB.toFixed(2)}s)`);
    }
  }, [ensureAudio, getEngine]);

  // Nudge: temporarily speed up or slow down a deck to manually phase-align beats.
  // Hold << to slow down (let other deck catch up), >> to speed up (push ahead).
  const handleNudge = useCallback(
    (id: DeckId, direction: 'forward' | 'back') => {
      const engine = getEngine(id);
      const state = useDeckStore.getState();
      const currentBpm = id === 'A' ? state.deckA.bpm : state.deckB.bpm;
      if (currentBpm <= 0) return;
      // Nudge by ±8% of current BPM while held
      const nudgedBpm = direction === 'forward' ? currentBpm * 1.08 : currentBpm * 0.92;
      engine.setPlaybackRate(nudgedBpm / currentBpm);
    },
    [getEngine],
  );

  const handleNudgeEnd = useCallback(
    (id: DeckId) => {
      const engine = getEngine(id);
      // Restore normal rate (1.0 relative to the stored bpm)
      engine.setPlaybackRate(1.0);
    },
    [getEngine],
  );

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
        currentTrackA={deckA.track}
        currentTrackB={deckB.track}
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
        {/* AI Assistant Panel */}
        <AIPanel />

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
            onPlayPause={() => handlePlayPause('A')}
            onStemToggle={(stem) => toggleStem('A', stem)}
            onVolumeChange={(v) => setVolume('A', v)}
            onEQChange={(band, val) => setEQ('A', band, val)}
            onSeek={(p) => seekDeck('A', p * deckA.duration)}
            onNudge={(dir) => handleNudge('A', dir)}
            onNudgeEnd={() => handleNudgeEnd('A')}
          />

          {/* Mixer */}
          <Mixer
            crossfader={crossfader}
            masterVolume={masterVolume}
            bpmA={deckA.bpm}
            bpmB={deckB.bpm}
            onCrossfaderChange={setCrossfader}
            onMasterVolumeChange={(v) => {
              useDeckStore.setState({ masterVolume: v });
            }}
            onSync={handleSync}
          />

          {/* Deck B */}
          <DeckView
            deckId="B"
            state={deckB}
            onPlayPause={() => handlePlayPause('B')}
            onStemToggle={(stem) => toggleStem('B', stem)}
            onVolumeChange={(v) => setVolume('B', v)}
            onEQChange={(band, val) => setEQ('B', band, val)}
            onSeek={(p) => seekDeck('B', p * deckB.duration)}
            onNudge={(dir) => handleNudge('B', dir)}
            onNudgeEnd={() => handleNudgeEnd('B')}
          />
        </div>
      </div>

      {/* Floating overlays */}
      <KeyboardHints />
      <TutorialOverlay />
    </div>
  );
}
