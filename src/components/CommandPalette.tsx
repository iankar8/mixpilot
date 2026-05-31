import { useEffect, useMemo, useRef, useState } from 'react';
import type { DeckId, Track } from '../lib/types';
import { TRACKS_WITH_BPM } from './Library';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onLoadTrack: (track: Track, targetDeck: DeckId) => void;
  defaultDeck: DeckId;
}

export default function CommandPalette({
  open,
  onClose,
  onLoadTrack,
  defaultDeck,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tracks = q
      ? TRACKS_WITH_BPM.filter((track) =>
          `${track.artist} ${track.name}`.toLowerCase().includes(q),
        )
      : TRACKS_WITH_BPM;
    return tracks.slice(0, 9);
  }, [query]);
  const activeSelected = results.length > 0 ? Math.min(selected, results.length - 1) : 0;

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelected((value) => (results.length ? Math.min(results.length - 1, value + 1) : 0));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelected((value) => Math.max(0, value - 1));
      }
      if (event.key === 'Enter' && results[activeSelected]) {
        event.preventDefault();
        onLoadTrack(results[activeSelected], event.shiftKey ? (defaultDeck === 'A' ? 'B' : 'A') : defaultDeck);
        onClose();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSelected, defaultDeck, onClose, onLoadTrack, open, results]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(5,5,7,0.66)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '9vh',
      }}
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-label="Load a track"
        style={{
          width: 'min(720px, calc(100vw - 32px))',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-strong)',
          borderRadius: '8px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.44)',
          overflow: 'hidden',
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span style={{ color: 'var(--accent)', fontFamily: 'ui-monospace, monospace' }}>/</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            placeholder={`Search songs, then Enter loads Deck ${defaultDeck}`}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '16px',
              fontFamily: 'system-ui, sans-serif',
            }}
          />
          <span className="micro-label">shift enter flips deck</span>
        </div>

        <div style={{ maxHeight: '440px', overflowY: 'auto', padding: '6px' }}>
          {results.map((track, index) => {
            const active = index === activeSelected;
            return (
              <button
                key={track.id}
                onMouseEnter={() => setSelected(index)}
                onClick={() => {
                  onLoadTrack(track, defaultDeck);
                  onClose();
                }}
                style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: '12px',
                  alignItems: 'center',
                  padding: '10px 12px',
                  border: 'none',
                  borderRadius: '6px',
                  background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>{track.name}</span>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {track.artist}
                  </span>
                </span>
                <span className="mono-readout">{track.bpm?.toFixed(0) ?? '---'} BPM</span>
                <span className="deck-pill">{defaultDeck}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
