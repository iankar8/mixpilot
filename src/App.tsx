import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Waveform from './components/Waveform';
import StemToggles from './components/StemToggles';
import { initAudio } from './audio/engine';
import { useKeyboard } from './hooks/useKeyboard';
import { useDeckStore } from './stores/deck-store';
import { getLibraryTracks, prepareRemixTrack } from './lib/sidecar';
import { getStemUrls } from './lib/types';
import type { PreparedRemixTrack, RemixPad, RemixTrack, StemType } from './lib/types';

const DUST_FILENAME = 'Drake - Dust.mp3';
const ALL_STEMS = { vocals: true, drums: true, bass: true, other: true };

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function stemSummary(pad: RemixPad): string {
  return Object.entries(pad.stemMix)
    .filter(([, active]) => active)
    .map(([stem]) => stem.slice(0, 3).toUpperCase())
    .join(' + ') || 'MUTE';
}

function statusLabel(status: string, track: RemixTrack | null): string {
  if (status === 'preparing') return track?.hasStems ? 'analyzing track' : 'separating stems';
  if (status === 'ready') return 'remix lab ready';
  if (status === 'error') return 'needs attention';
  return track?.hasStems ? 'ready to analyze' : 'stems needed';
}

export default function App() {
  const audioInitRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof window.setInterval> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [tracks, setTracks] = useState<RemixTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<RemixTrack | null>(null);
  const [prepared, setPrepared] = useState<PreparedRemixTrack | null>(null);
  const [status, setStatus] = useState<'idle' | 'preparing' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activePadId, setActivePadId] = useState<string | null>(null);

  const deck = useDeckStore((s) => s.deckA);
  const setDeckTrack = useDeckStore((s) => s.setDeckTrack);
  const setDeckPlaying = useDeckStore((s) => s.setDeckPlaying);
  const toggleStem = useDeckStore((s) => s.toggleStem);
  const setStemState = useDeckStore((s) => s.setStemState);
  const seekDeck = useDeckStore((s) => s.seekDeck);
  const getEngine = useDeckStore((s) => s.getEngine);

  const ensureAudio = useCallback(async () => {
    if (!audioInitRef.current) {
      await initAudio();
      audioInitRef.current = true;
    }
  }, []);

  const loadTracks = useCallback(async () => {
    const libraryTracks = await getLibraryTracks('Drake');
    setTracks(libraryTracks);
    setSelectedTrack((current) => (
      current
        ? libraryTracks.find((item) => item.filename === current.filename) ?? current
        : libraryTracks.find((item) => item.filename === DUST_FILENAME) ?? libraryTracks[0] ?? null
    ));
  }, []);

  useEffect(() => {
    let cancelled = false;

    getLibraryTracks('Drake')
      .then((libraryTracks) => {
        if (cancelled) return;
        setTracks(libraryTracks);
        setSelectedTrack(libraryTracks.find((item) => item.filename === DUST_FILENAME) ?? libraryTracks[0] ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
        setSelectedTrack({
          id: 'drake-dust',
          artist: 'Drake',
          name: 'Dust',
          filename: DUST_FILENAME,
          hasStems: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => {
      const engine = getEngine('A');
      useDeckStore.getState().setCurrentTime('A', engine.getCurrentTime());
    }, 250);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [getEngine]);

  useEffect(() => {
    if (paletteOpen) {
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [paletteOpen]);

  const loadPreparedTrack = useCallback(
    async (nextPrepared: PreparedRemixTrack) => {
      const bpm = nextPrepared.analysis.bpm.resolved;
      const track = {
        ...nextPrepared.track,
        bpm,
        duration: nextPrepared.analysis.duration,
      };
      const engine = getEngine('A');

      setDeckPlaying('A', false);
      setDeckTrack('A', track);
      await engine.loadStems(getStemUrls(track.filename));

      const duration = engine.getDuration() || nextPrepared.analysis.duration;
      const peaks = engine.getPeaks('drums', 700);
      useDeckStore.setState((state) => ({
        deckA: {
          ...state.deckA,
          duration,
          bpm,
          peaks,
          currentTime: 0,
          playbackRate: 1,
        },
      }));
      setStemState('A', ALL_STEMS);
    },
    [getEngine, setDeckPlaying, setDeckTrack, setStemState],
  );

  const handlePrepareTrack = useCallback(
    async (force = false) => {
      if (!selectedTrack) return;
      setStatus('preparing');
      setError(null);
      setActivePadId(null);

      try {
        const nextPrepared = await prepareRemixTrack(selectedTrack.filename, force);
        await loadPreparedTrack(nextPrepared);
        setPrepared(nextPrepared);
        setSelectedTrack(nextPrepared.track);
        setStatus('ready');
        void loadTracks();
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [loadPreparedTrack, loadTracks, selectedTrack],
  );

  const handleSelectTrack = useCallback((track: RemixTrack) => {
    setSelectedTrack(track);
    setPrepared(null);
    setStatus('idle');
    setError(null);
    setActivePadId(null);
    setDeckPlaying('A', false);
    setPaletteOpen(false);
  }, [setDeckPlaying]);

  const handlePlayPause = useCallback(async () => {
    if (status !== 'ready' || deck.duration <= 0) return;
    await ensureAudio();
    setDeckPlaying('A', !deck.isPlaying);
  }, [deck.duration, deck.isPlaying, ensureAudio, setDeckPlaying, status]);

  const handleTriggerPad = useCallback(
    async (pad: RemixPad) => {
      if (status !== 'ready') return;
      await ensureAudio();
      getEngine('A').triggerRegion(pad.start, pad.duration, pad.stemMix);
      setActivePadId(pad.id);
      window.setTimeout(() => {
        setActivePadId((current) => (current === pad.id ? null : current));
      }, Math.min(2400, Math.max(700, pad.duration * 300)));
    },
    [ensureAudio, getEngine, status],
  );

  useKeyboard({
    onOpenSearch: () => setPaletteOpen(true),
    pads: prepared?.plan.pads ?? [],
    onTriggerPad: handleTriggerPad,
  });

  const filteredTracks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tracks;
    return tracks.filter((track) => (
      track.name.toLowerCase().includes(query) ||
      track.artist.toLowerCase().includes(query)
    ));
  }, [search, tracks]);

  const prepareDisabled = status === 'preparing' || !selectedTrack;
  const plan = prepared?.plan;
  const analysis = prepared?.analysis;

  return (
    <div className="remix-shell">
      <aside className="remix-library" aria-label="Iceman track library">
        <div className="remix-brand">
          <div className="brand-name">mixmash</div>
          <div className="brand-subtitle">Iceman Remix Lab</div>
        </div>

        <button className="library-search-button" onClick={() => setPaletteOpen(true)}>
          Search Iceman tracks
        </button>

        <div className="track-list">
          {tracks.map((track) => (
            <button
              key={track.filename}
              className={`remix-track-row ${selectedTrack?.filename === track.filename ? 'remix-track-row-active' : ''}`}
              onClick={() => handleSelectTrack(track)}
            >
              <span>
                <strong>{track.name}</strong>
                <small>{formatTime(track.duration ?? 0)}</small>
              </span>
              <em>{track.hasStems ? 'stems' : 'prep'}</em>
            </button>
          ))}
        </div>
      </aside>

      <main className="remix-workspace">
        <header className="remix-topbar">
          <div>
            <div className="section-kicker">single-song remix lab</div>
            <h1>{selectedTrack?.name ?? 'Choose a track'}</h1>
            <p>{selectedTrack?.artist ?? 'Drake'} · {statusLabel(status, selectedTrack)}</p>
          </div>
          <div className="remix-actions">
            <button className="ghost-button" onClick={() => void handlePrepareTrack(true)} disabled={prepareDisabled}>
              Rebuild
            </button>
            <button className="primary-button" onClick={() => void handlePrepareTrack(false)} disabled={prepareDisabled}>
              {status === 'preparing' ? 'Preparing...' : selectedTrack?.hasStems ? 'Analyze' : 'Prepare Stems'}
            </button>
          </div>
        </header>

        {error && <div className="remix-alert">{error}</div>}

        <section className="remix-hero">
          <div className="remix-transport">
            <button className={`remix-play ${deck.isPlaying ? 'remix-play-active' : ''}`} onClick={() => void handlePlayPause()} disabled={status !== 'ready'}>
              {deck.isPlaying ? 'Pause' : 'Play'}
            </button>
            <div className="remix-readout">
              <strong>{deck.bpm ? `${deck.bpm.toFixed(0)} BPM` : '--- BPM'}</strong>
              <span>{formatTime(deck.currentTime)} / {formatTime(deck.duration || analysis?.duration || selectedTrack?.duration || 0)}</span>
            </div>
          </div>

          <Waveform
            peaks={deck.peaks}
            progress={deck.duration > 0 ? deck.currentTime / deck.duration : 0}
            color="#f3c85f"
            height={124}
            onSeek={(progress) => {
              if (deck.duration > 0) seekDeck('A', progress * deck.duration);
            }}
          />

          <StemToggles
            deckId="A"
            stems={deck.stems}
            onToggle={(stem: StemType) => toggleStem('A', stem)}
          />
        </section>

        <section className="remix-grid">
          <div className="remix-panel remix-plan-panel">
            <div className="panel-header">
              <div>
                <div className="section-kicker">remix worksheet</div>
                <div className="panel-title">Anchor + arrangement</div>
              </div>
              <span className="mono-readout">{plan?.source ?? 'waiting'}</span>
            </div>
            {plan ? (
              <>
                <p className="anchor-idea">{plan.anchorIdea}</p>
                <div className="worksheet-columns">
                  <div>
                    <h3>Arrangement</h3>
                    <ol>
                      {plan.arrangement.map((step) => <li key={step}>{step}</li>)}
                    </ol>
                  </div>
                  <div>
                    <h3>Production notes</h3>
                    <ul>
                      {plan.productionNotes.map((note) => <li key={note}>{note}</li>)}
                    </ul>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-remix-state">
                Prepare Dust or another Iceman track to generate a remix worksheet.
              </div>
            )}
          </div>

          <div className="remix-panel">
            <div className="panel-header">
              <div>
                <div className="section-kicker">moments</div>
                <div className="panel-title">Best source material</div>
              </div>
            </div>
            <div className="moment-list">
              {(plan?.moments ?? []).map((moment) => (
                <button key={moment.id} onClick={() => seekDeck('A', moment.start)} className="moment-row">
                  <span>{moment.label}</span>
                  <small>{formatTime(moment.start)} - {formatTime(moment.end)}</small>
                </button>
              ))}
              {!plan && <div className="empty-remix-state">No moments yet.</div>}
            </div>
          </div>
        </section>

        <section className="remix-panel">
          <div className="panel-header">
            <div>
              <div className="section-kicker">pads</div>
              <div className="panel-title">Playable remix material</div>
            </div>
          </div>
          <div className="remix-pad-grid">
            {(plan?.pads ?? []).map((pad, index) => (
              <button
                key={pad.id}
                className={`remix-pad ${activePadId === pad.id ? 'remix-pad-active' : ''}`}
                onClick={() => void handleTriggerPad(pad)}
                disabled={status !== 'ready'}
              >
                <span className="pad-key">{index + 1}</span>
                <strong>{pad.name}</strong>
                <em>{formatTime(pad.start)} · {formatTime(pad.duration)} · {stemSummary(pad)}</em>
                <small>{pad.description}</small>
              </button>
            ))}
            {!plan && <div className="empty-remix-state">Pads appear after preparation.</div>}
          </div>
        </section>
      </main>

      {paletteOpen && (
        <div className="command-backdrop" onMouseDown={() => setPaletteOpen(false)}>
          <div className="remix-command" onMouseDown={(event) => event.stopPropagation()}>
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Iceman tracks..."
              onKeyDown={(event) => {
                if (event.key === 'Escape') setPaletteOpen(false);
                if (event.key === 'Enter' && filteredTracks[0]) handleSelectTrack(filteredTracks[0]);
              }}
            />
            <div className="command-results">
              {filteredTracks.slice(0, 12).map((track) => (
                <button key={track.filename} onClick={() => handleSelectTrack(track)}>
                  <span>{track.name}</span>
                  <small>{track.hasStems ? 'stems ready' : 'needs prep'}</small>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
