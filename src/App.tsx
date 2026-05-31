import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Library, { TRACKS_WITH_BPM } from './components/Library';
import DeckView from './components/DeckView';
import Mixer from './components/Mixer';
import KeyboardHints from './components/KeyboardHints';
import CommandPalette from './components/CommandPalette';
import MashupHeader from './components/MashupHeader';
import SceneStrip from './components/SceneStrip';
import PerformanceKeyboard from './components/PerformanceKeyboard';
import ProductionPad from './components/ProductionPad';
import MashupInbox from './components/MashupInbox';
import { useDeckStore } from './stores/deck-store';
import { useKeyboard } from './hooks/useKeyboard';
import { initAudio } from './audio/engine';
import { syncDecks } from './audio/sync';
import {
  analyzeTrackForMashup,
  buildMashupAnalysis,
  mashupAnalysisFromPair,
  trackAnalysisFromV2,
} from './lib/analysis';
import { generateMashupScenes } from './lib/scenes';
import {
  getLibraryAnalysisV2Status,
  getLibraryAnalysisStatus,
  getMashupCandidates,
  loadCandidateSession,
  prepareMashupInbox,
  startLibraryBackgroundAnalysis,
  startLibraryBackgroundAnalysisV2,
  suggestScenesWithSidecar,
  type SceneStatus,
} from './lib/sidecar';
import type { DeckId, MashupAnalysis, MashupCandidate, MashupScene, SceneAutomationEvent, Track, TrackAnalysis } from './lib/types';
import { getTrackUrl, getStemUrls } from './lib/types';
import { BPM_ESTIMATES } from './lib/recommendations';

function deckKey(id: DeckId): 'deckA' | 'deckB' {
  return id === 'A' ? 'deckA' : 'deckB';
}

export default function App() {
  const audioInitRef = useRef(false);
  const sceneTimersRef = useRef<number[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [analyses, setAnalyses] = useState<Partial<Record<DeckId, TrackAnalysis>>>({});
  const [mashup, setMashup] = useState<MashupAnalysis | null>(null);
  const [modelScenes, setModelScenes] = useState<MashupScene[]>([]);
  const [sceneStatus, setSceneStatus] = useState<SceneStatus>('fallback');
  const [libraryAnalysisLabel, setLibraryAnalysisLabel] = useState('sidecar warming');
  const [inboxStatusLabel, setInboxStatusLabel] = useState('preparing analysis');
  const [mashupCandidates, setMashupCandidates] = useState<MashupCandidate[]>([]);
  const [activeCandidate, setActiveCandidate] = useState<MashupCandidate | null>(null);
  const [loadingCandidateId, setLoadingCandidateId] = useState<string | null>(null);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);

  const deckA = useDeckStore((s) => s.deckA);
  const deckB = useDeckStore((s) => s.deckB);
  const crossfader = useDeckStore((s) => s.crossfader);
  const masterVolume = useDeckStore((s) => s.masterVolume);
  const setDeckTrack = useDeckStore((s) => s.setDeckTrack);
  const setDeckPlaying = useDeckStore((s) => s.setDeckPlaying);
  const toggleStem = useDeckStore((s) => s.toggleStem);
  const setStemState = useDeckStore((s) => s.setStemState);
  const setVolume = useDeckStore((s) => s.setVolume);
  const setEQ = useDeckStore((s) => s.setEQ);
  const setCrossfader = useDeckStore((s) => s.setCrossfader);
  const setPlaybackRate = useDeckStore((s) => s.setPlaybackRate);
  const getEngine = useDeckStore((s) => s.getEngine);
  const seekDeck = useDeckStore((s) => s.seekDeck);

  const defaultDeck: DeckId = deckA.track && !deckB.track ? 'B' : 'A';
  const readyMashup = useMemo(() => {
    if (!deckA.track || !deckB.track || !analyses.A || !analyses.B) return null;
    return buildMashupAnalysis(deckA, deckB, analyses.A, analyses.B);
  }, [analyses.A, analyses.B, deckA, deckB]);
  const visibleMashup = mashup ?? readyMashup;
  const scenes = useMemo(
    () => modelScenes.length > 0 ? modelScenes : generateMashupScenes(visibleMashup, deckA.track, deckB.track),
    [deckA.track, deckB.track, modelScenes, visibleMashup],
  );
  const sceneStatusLabel = activeCandidate
    ? `timed · ${activeCandidate.source.includes('claude') ? 'claude labeled' : 'local dsp'}`
    : sceneStatus === 'model'
      ? 'claude sidecar'
      : sceneStatus === 'loading'
        ? 'asking claude'
        : sceneStatus === 'offline'
          ? 'browser fallback'
          : sceneStatus === 'error'
            ? 'fallback after error'
            : 'browser fallback';

  const ensureAudio = useCallback(async () => {
    if (!audioInitRef.current) {
      await initAudio();
      audioInitRef.current = true;
    }
  }, []);

  const clearSceneTimers = useCallback(() => {
    for (const timer of sceneTimersRef.current) {
      window.clearTimeout(timer);
    }
    sceneTimersRef.current = [];
  }, []);

  const applySceneEvent = useCallback(
    (event: SceneAutomationEvent) => {
      if (event.action === 'setCrossfader' && typeof event.value === 'number') {
        setCrossfader(event.value);
        return;
      }

      if (event.action === 'setStem' && event.deck && event.stem && typeof event.active === 'boolean') {
        const current = useDeckStore.getState()[deckKey(event.deck)].stems;
        setStemState(event.deck, { ...current, [event.stem]: event.active });
      }
    },
    [setCrossfader, setStemState],
  );

  const scheduleSceneEvents = useCallback(
    (scene: MashupScene) => {
      clearSceneTimers();
      if (!scene.events?.length) return;
      const bpm = scene.playbackRates ? (mashup?.targetBpm ?? readyMashup?.targetBpm ?? 128) : 128;
      const barMs = (60_000 / Math.max(1, bpm)) * 4;

      for (const event of scene.events) {
        const delay = Math.max(0, (event.atBar - 1) * barMs);
        const timer = window.setTimeout(() => applySceneEvent(event), delay);
        sceneTimersRef.current.push(timer);
      }
    },
    [applySceneEvent, clearSceneTimers, mashup?.targetBpm, readyMashup?.targetBpm],
  );

  const handleApplyScene = useCallback(
    (scene: MashupScene) => {
      if (scene.playbackRates) {
        setPlaybackRate('A', scene.playbackRates.A, visibleMashup?.targetBpm);
        setPlaybackRate('B', scene.playbackRates.B, visibleMashup?.targetBpm);
      }
      if (scene.startOffsets) {
        seekDeck('A', scene.startOffsets.A);
        seekDeck('B', scene.startOffsets.B);
      }
      setStemState('A', scene.deckAStems);
      setStemState('B', scene.deckBStems);
      setCrossfader(scene.crossfader);
      setActiveSceneId(scene.id);
      scheduleSceneEvents(scene);
    },
    [scheduleSceneEvents, seekDeck, setCrossfader, setPlaybackRate, setStemState, visibleMashup?.targetBpm],
  );

  const requestModelScenes = useCallback(
    async (
      pair: MashupAnalysis,
      trackA: Track,
      trackB: Track,
      analysisA: TrackAnalysis,
      analysisB: TrackAnalysis,
    ) => {
      setSceneStatus('loading');
      try {
        const nextScenes = await suggestScenesWithSidecar({
          trackA,
          trackB,
          analysisA,
          analysisB,
          mashup: pair,
        });
        setModelScenes(nextScenes);
        setActiveSceneId(null);
        setSceneStatus('model');
      } catch (error) {
        console.warn('[mixmash] sidecar scene generation unavailable', error);
        setModelScenes([]);
        setSceneStatus('offline');
      }
    },
    [],
  );

  const handleSync = useCallback(async () => {
    void ensureAudio().catch((err) => {
      console.warn('[mixmash] Audio unlock deferred until the next gesture', err);
    });

    const state = useDeckStore.getState();
    const analysisA = analyses.A;
    const analysisB = analyses.B;
    if (!state.deckA.track || !state.deckB.track || !analysisA || !analysisB) return;

    const pair = buildMashupAnalysis(state.deckA, state.deckB, analysisA, analysisB);
    const engineA = getEngine('A');
    const engineB = getEngine('B');

    syncDecks(engineA, engineB, pair.targetBpm, analysisA.bpm, analysisB.bpm);
    setPlaybackRate('A', pair.deckARate, pair.targetBpm);
    setPlaybackRate('B', pair.deckBRate, pair.targetBpm);
    seekDeck('B', pair.deckBSeek);

    setMashup({ ...pair, status: 'synced' });
    void requestModelScenes({ ...pair, status: 'synced' }, state.deckA.track, state.deckB.track, analysisA, analysisB);
  }, [analyses.A, analyses.B, ensureAudio, getEngine, requestModelScenes, seekDeck, setPlaybackRate]);

  useKeyboard({
    onOpenSearch: () => setPaletteOpen(true),
    onSync: handleSync,
    scenes,
    onApplyScene: handleApplyScene,
  });

  const handleLoadTrack = useCallback(
    async (track: Track, targetDeck: DeckId) => {
      const bpm = track.bpm ?? BPM_ESTIMATES[track.artist] ?? 128;
      const trackWithBpm = { ...track, bpm };

      setDeckTrack(targetDeck, trackWithBpm);
      setMashup(null);
      setModelScenes([]);
      setSceneStatus('fallback');
      setActiveCandidate(null);
      clearSceneTimers();
      setActiveSceneId(null);
      setAnalyses((current) => {
        const next = { ...current };
        delete next[targetDeck];
        return next;
      });

      void ensureAudio().catch((err) => {
        console.warn('[mixmash] Audio unlock deferred until playback', err);
      });

      const engine = getEngine(targetDeck);
      const stemUrls = getStemUrls(track.filename);

      try {
        await engine.loadStems(stemUrls);
        console.log(`[mixmash] Loaded stems for ${track.name} on Deck ${targetDeck}`);
      } catch (err) {
        console.warn(`[mixmash] Stems not available for ${track.name}, loading full track`, err);
        const fullUrl = getTrackUrl(track.filename);
        try {
          await engine.loadStems({
            vocals: fullUrl,
            drums: fullUrl,
            bass: fullUrl,
            other: fullUrl,
          });
          console.log(`[mixmash] Loaded full track for ${track.name} on Deck ${targetDeck}`);
        } catch (fallbackErr) {
          console.error(`[mixmash] Failed to load track ${track.name}`, fallbackErr);
        }
      }

      const duration = engine.getDuration();
      const peaks = engine.getPeaks('drums', 500);
      const key = deckKey(targetDeck);
      useDeckStore.setState((s) => ({
        [key]: { ...s[key], duration, bpm, peaks, playbackRate: 1 },
      }));

      const deckState = useDeckStore.getState()[key];
      const analysis = await analyzeTrackForMashup(trackWithBpm, deckState);
      setAnalyses((current) => ({ ...current, [targetDeck]: analysis }));
    },
    [clearSceneTimers, ensureAudio, getEngine, setDeckTrack],
  );

  const loadCandidateDeck = useCallback(
    async (
      track: Track,
      targetDeck: DeckId,
      analysis: MashupCandidate['analysisA'],
      startOffset: number,
      playbackRate: number,
      targetBpm: number,
    ) => {
      const trackWithBpm = {
        ...track,
        bpm: analysis.bpm.resolved,
        duration: analysis.duration,
      };
      setDeckTrack(targetDeck, trackWithBpm);

      const engine = getEngine(targetDeck);
      const stemUrls = getStemUrls(track.filename);

      try {
        await engine.loadStems(stemUrls);
      } catch {
        const fullUrl = getTrackUrl(track.filename);
        await engine.loadStems({
          vocals: fullUrl,
          drums: fullUrl,
          bass: fullUrl,
          other: fullUrl,
        });
      }

      const duration = engine.getDuration() || analysis.duration;
      const peaks = engine.getPeaks('drums', 500);
      const key = deckKey(targetDeck);
      useDeckStore.setState((state) => ({
        [key]: {
          ...state[key],
          duration,
          bpm: analysis.bpm.resolved,
          peaks,
          playbackRate: 1,
        },
      }));

      setPlaybackRate(targetDeck, playbackRate, targetBpm);
      seekDeck(targetDeck, startOffset);
    },
    [getEngine, seekDeck, setDeckTrack, setPlaybackRate],
  );

  const handleLoadCandidate = useCallback(
    async (candidate: MashupCandidate) => {
      clearSceneTimers();
      setLoadingCandidateId(candidate.id);
      try {
        await ensureAudio();
        const session = await loadCandidateSession(candidate.id).catch(() => candidate);

        setActiveCandidate(session);
        setMashup(mashupAnalysisFromPair(session.pair, session.warnings));
        setAnalyses({
          A: trackAnalysisFromV2(session.analysisA),
          B: trackAnalysisFromV2(session.analysisB),
        });
        setModelScenes(session.scenes);
        setSceneStatus(session.source.includes('claude') ? 'model' : 'fallback');

        await Promise.all([
          loadCandidateDeck(
            session.trackA,
            'A',
            session.analysisA,
            session.pair.deckAStart,
            session.pair.deckARate,
            session.pair.targetBpm,
          ),
          loadCandidateDeck(
            session.trackB,
            'B',
            session.analysisB,
            session.pair.deckBStart,
            session.pair.deckBRate,
            session.pair.targetBpm,
          ),
        ]);

        const firstScene = session.scenes[0];
        if (firstScene) {
          setStemState('A', firstScene.deckAStems);
          setStemState('B', firstScene.deckBStems);
          setCrossfader(firstScene.crossfader);
          setActiveSceneId(firstScene.id);
        }

        setDeckPlaying('A', true);
        setDeckPlaying('B', true);
      } catch (error) {
        console.warn('[mixmash] failed to load candidate session', error);
      } finally {
        setLoadingCandidateId(null);
      }
    },
    [
      clearSceneTimers,
      ensureAudio,
      loadCandidateDeck,
      setCrossfader,
      setDeckPlaying,
      setStemState,
    ],
  );

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

  const refreshMashupInbox = useCallback(async () => {
    setInboxStatusLabel('preparing inbox');
    try {
      const response = await prepareMashupInbox(TRACKS_WITH_BPM);
      setMashupCandidates(response.candidates);
      setInboxStatusLabel(
        response.candidates.length
          ? `${response.candidates.length} candidates · ${response.source ?? 'local'}`
          : response.status === 'analysis-running'
            ? 'analysis running'
            : 'no strong candidates yet',
      );
    } catch (error) {
      console.warn('[mixmash] mashup inbox unavailable', error);
      setInboxStatusLabel('inbox offline');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof window.setInterval> | null = null;

    async function startBackgroundAnalysis() {
      try {
        void startLibraryBackgroundAnalysis(TRACKS_WITH_BPM).catch(() => undefined);
        const v2Start = await startLibraryBackgroundAnalysisV2(TRACKS_WITH_BPM);
        if (cancelled) return;
        setLibraryAnalysisLabel(
          v2Start.running
            ? `v2 ${v2Start.completed}/${v2Start.total}`
            : `v2 cache ${v2Start.cacheCount}`,
        );
        await refreshMashupInbox();

        interval = window.setInterval(async () => {
          try {
            const [status, candidates] = await Promise.all([
              getLibraryAnalysisV2Status(),
              getMashupCandidates(),
            ]);
            if (cancelled) return;

            if (status.running) {
              setLibraryAnalysisLabel(`v2 ${status.completed}/${status.total}`);
              setInboxStatusLabel(`analyzing ${status.completed}/${status.total}`);
            } else {
              setLibraryAnalysisLabel(`v2 cache ${status.cacheCount}`);
              if (candidates.candidates.length) {
                setMashupCandidates(candidates.candidates);
                setInboxStatusLabel(`${candidates.candidates.length} candidates · ${candidates.source ?? 'local'}`);
              } else {
                await refreshMashupInbox();
              }
            }
          } catch {
            if (!cancelled) {
              setLibraryAnalysisLabel('sidecar offline');
              setInboxStatusLabel('inbox offline');
            }
          }
        }, 3000);
      } catch {
        if (!cancelled) {
          try {
            const legacy = await getLibraryAnalysisStatus();
            setLibraryAnalysisLabel(`legacy cache ${legacy.cacheCount}`);
          } catch {
            setLibraryAnalysisLabel('sidecar offline');
          }
          setInboxStatusLabel('analysis v2 offline');
        }
      }
    }

    void startBackgroundAnalysis();

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
      clearSceneTimers();
    };
  }, [clearSceneTimers, refreshMashupInbox]);

  const handlePlayPause = useCallback(
    async (id: DeckId) => {
      void ensureAudio().catch((err) => {
        console.warn('[mixmash] Audio unlock deferred until the next gesture', err);
      });
      const state = useDeckStore.getState();
      const deck = id === 'A' ? state.deckA : state.deckB;
      if (!deck.isPlaying && (!deck.track || deck.duration <= 0)) return;
      setDeckPlaying(id, !deck.isPlaying);
    },
    [ensureAudio, setDeckPlaying],
  );

  const handleNudge = useCallback(
    (id: DeckId, direction: 'forward' | 'back') => {
      const engine = getEngine(id);
      const state = useDeckStore.getState();
      const deck = id === 'A' ? state.deckA : state.deckB;
      const baseRate = deck.playbackRate || 1;
      engine.setPlaybackRate(baseRate * (direction === 'forward' ? 1.08 : 0.92));
    },
    [getEngine],
  );

  const handleNudgeEnd = useCallback(
    (id: DeckId) => {
      const engine = getEngine(id);
      const state = useDeckStore.getState();
      const deck = id === 'A' ? state.deckA : state.deckB;
      engine.setPlaybackRate(deck.playbackRate || 1);
    },
    [getEngine],
  );

  const effectiveProductionBpm = visibleMashup?.targetBpm ?? deckA.bpm ?? deckB.bpm ?? 128;

  return (
    <div className="app-shell" onClick={ensureAudio}>
      <Library
        onLoadTrack={handleLoadTrack}
        deckALoaded={deckA.track !== null}
        deckBLoaded={deckB.track !== null}
        currentTrackA={deckA.track}
        currentTrackB={deckB.track}
      />

      <main className="workspace">
        <MashupHeader
          deckA={deckA}
          deckB={deckB}
          analysisA={analyses.A}
          analysisB={analyses.B}
          mashup={visibleMashup}
          sidecarLabel={libraryAnalysisLabel}
          onOpenSearch={() => setPaletteOpen(true)}
          onSync={handleSync}
        />

        <div className="workspace-body custom-scrollbar">
          {!activeCandidate ? (
            <MashupInbox
              candidates={mashupCandidates}
              statusLabel={inboxStatusLabel}
              loadingCandidateId={loadingCandidateId}
              onRefresh={refreshMashupInbox}
              onLoadCandidate={handleLoadCandidate}
            />
          ) : (
            <>
              <div className="active-candidate-strip">
                <span>
                  <strong>{activeCandidate.title}</strong>
                  {activeCandidate.subtitle}
                </span>
                <button
                  className="ghost-button"
                  onClick={() => {
                    clearSceneTimers();
                    setActiveCandidate(null);
                    setDeckPlaying('A', false);
                    setDeckPlaying('B', false);
                  }}
                >
                  inbox
                </button>
              </div>

              <section className="deck-rig">
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
              </section>

              <SceneStrip
                scenes={scenes}
                activeSceneId={activeSceneId}
                statusLabel={sceneStatusLabel}
                onApplyScene={handleApplyScene}
              />

              <div className="bottom-instrument-grid">
                <PerformanceKeyboard
                  scenes={scenes}
                  activeSceneId={activeSceneId}
                  onApplyScene={handleApplyScene}
                />
                <ProductionPad bpm={effectiveProductionBpm} />
              </div>
            </>
          )}
        </div>
      </main>

      <KeyboardHints />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onLoadTrack={handleLoadTrack}
        defaultDeck={defaultDeck}
      />
    </div>
  );
}
