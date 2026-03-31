import { useState, useCallback } from 'react';
import Library from './components/Library';
import DeckView from './components/DeckView';
import Mixer from './components/Mixer';
import CoachOverlay from './components/CoachOverlay';
import KeyboardHints from './components/KeyboardHints';
import type { DeckState, MixerState, Track, DeckId, StemName } from './components/types';

function createEmptyDeck(id: DeckId): DeckState {
  return {
    id,
    track: null,
    isPlaying: false,
    bpm: 0,
    volume: 0.8,
    stems: { vocals: true, drums: true, bass: true, other: true },
    eq: { hi: 0, mid: 0, lo: 0 },
    position: 0,
    duration: 0,
  };
}

export default function App() {
  const [deckA, setDeckA] = useState<DeckState>(createEmptyDeck('A'));
  const [deckB, setDeckB] = useState<DeckState>(createEmptyDeck('B'));
  const [mixer, setMixer] = useState<MixerState>({ crossfader: 0, masterVolume: 0.8 });

  const setDeck = (id: DeckId) => (id === 'A' ? setDeckA : setDeckB);

  const handleLoadTrack = useCallback((track: Track, targetDeck: DeckId) => {
    setDeck(targetDeck)((prev) => ({
      ...prev,
      track,
      isPlaying: false,
      position: 0,
    }));
  }, []);

  const handlePlayPause = useCallback((id: DeckId) => {
    setDeck(id)((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const handleStemToggle = useCallback((id: DeckId, stem: StemName) => {
    setDeck(id)((prev) => ({
      ...prev,
      stems: { ...prev.stems, [stem]: !prev.stems[stem] },
    }));
  }, []);

  const handleVolumeChange = useCallback((id: DeckId, volume: number) => {
    setDeck(id)((prev) => ({ ...prev, volume }));
  }, []);

  const handleEQChange = useCallback((id: DeckId, band: 'hi' | 'mid' | 'lo', value: number) => {
    setDeck(id)((prev) => ({
      ...prev,
      eq: { ...prev.eq, [band]: value },
    }));
  }, []);

  const handleCrossfaderChange = useCallback((value: number) => {
    setMixer((prev) => ({ ...prev, crossfader: value }));
  }, []);

  const handleMasterVolumeChange = useCallback((value: number) => {
    setMixer((prev) => ({ ...prev, masterVolume: value }));
  }, []);

  const handleSync = useCallback(() => {
    // Stub: audio engine will handle actual sync
    console.log('Sync triggered');
  }, []);

  const hasTracksLoaded = deckA.track !== null || deckB.track !== null;

  return (
    <div
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
            onPlayPause={() => handlePlayPause('A')}
            onStemToggle={(stem) => handleStemToggle('A', stem)}
            onVolumeChange={(v) => handleVolumeChange('A', v)}
            onEQChange={(band, val) => handleEQChange('A', band, val)}
          />

          {/* Mixer */}
          <Mixer
            state={mixer}
            bpmA={deckA.bpm}
            bpmB={deckB.bpm}
            onCrossfaderChange={handleCrossfaderChange}
            onMasterVolumeChange={handleMasterVolumeChange}
            onSync={handleSync}
          />

          {/* Deck B */}
          <DeckView
            deckId="B"
            state={deckB}
            onPlayPause={() => handlePlayPause('B')}
            onStemToggle={(stem) => handleStemToggle('B', stem)}
            onVolumeChange={(v) => handleVolumeChange('B', v)}
            onEQChange={(band, val) => handleEQChange('B', band, val)}
          />
        </div>
      </div>

      {/* Floating overlays */}
      <CoachOverlay hasTracksLoaded={hasTracksLoaded} />
      <KeyboardHints />
    </div>
  );
}
