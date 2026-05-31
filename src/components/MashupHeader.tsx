import type { DeckState, MashupAnalysis, TrackAnalysis } from '../lib/types';

interface MashupHeaderProps {
  deckA: DeckState;
  deckB: DeckState;
  analysisA?: TrackAnalysis;
  analysisB?: TrackAnalysis;
  mashup: MashupAnalysis | null;
  sidecarLabel: string;
  onOpenSearch: () => void;
  onSync: () => void;
}

function SlotSummary({
  label,
  deck,
  analysis,
}: {
  label: 'A' | 'B';
  deck: DeckState;
  analysis?: TrackAnalysis;
}) {
  const bpmLabel =
    deck.track && analysis && deck.playbackRate !== 1
      ? `${analysis.bpm.toFixed(0)}→${deck.bpm.toFixed(0)} BPM`
      : `${analysis?.bpm.toFixed(0) ?? deck.bpm.toFixed(0)} BPM`;

  return (
    <div className="slot-summary">
      <span className={`deck-dot deck-dot-${label.toLowerCase()}`}>{label}</span>
      <span style={{ minWidth: 0 }}>
        <span className="slot-track">{deck.track?.name ?? 'empty slot'}</span>
        <span className="slot-meta">
          {deck.track ? `${deck.track.artist} · ${bpmLabel}` : 'load a song'}
        </span>
      </span>
    </div>
  );
}

export default function MashupHeader({
  deckA,
  deckB,
  analysisA,
  analysisB,
  mashup,
  sidecarLabel,
  onOpenSearch,
  onSync,
}: MashupHeaderProps) {
  const bothLoaded = Boolean(deckA.track && deckB.track);
  const stateLabel = !bothLoaded
    ? 'load two songs'
    : mashup?.status === 'synced'
      ? 'synced'
      : mashup?.status === 'warning'
        ? 'needs ears'
        : 'ready to sync';
  const confidence = mashup ? Math.round(mashup.confidence * 100) : null;

  return (
    <header className="mashup-header">
      <div className="brand-block">
        <div className="brand-name">mixmash</div>
        <div className="brand-subtitle">AI-assisted stem mashup instrument</div>
      </div>

      <div className="slot-strip">
        <SlotSummary label="A" deck={deckA} analysis={analysisA} />
        <SlotSummary label="B" deck={deckB} analysis={analysisB} />
      </div>

      <div className="header-actions">
        <div className={`sync-chip sync-chip-${mashup?.status ?? 'idle'}`}>
          <span>{stateLabel}</span>
          {confidence !== null && <strong>{confidence}%</strong>}
        </div>
        <div className="sync-chip">
          <span>{sidecarLabel}</span>
        </div>
        <button className="ghost-button" onClick={onOpenSearch}>
          <span className="keycap">/</span>
          search
        </button>
        <button className="primary-button" onClick={onSync} disabled={!bothLoaded}>
          auto sync
        </button>
      </div>
    </header>
  );
}
