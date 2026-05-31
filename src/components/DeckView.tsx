import { useState, useRef } from 'react';
import Waveform from './Waveform';
import StemToggles from './StemToggles';
import type { DeckId, DeckState, StemType } from '../lib/types';

interface DeckViewProps {
  deckId: DeckId;
  state: DeckState;
  onPlayPause: () => void;
  onStemToggle: (stem: StemType) => void;
  onVolumeChange: (volume: number) => void;
  onEQChange: (band: 'low' | 'mid' | 'high', value: number) => void;
  onSeek: (progress: number) => void;
  onNudge: (direction: 'forward' | 'back') => void;
  onNudgeEnd: () => void;
}

export default function DeckView({
  deckId,
  state,
  onPlayPause,
  onStemToggle,
  onVolumeChange,
  onEQChange,
  onSeek,
  onNudge,
  onNudgeEnd,
}: DeckViewProps) {
  const [hoverPlay, setHoverPlay] = useState(false);
  const nudgeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTrack = state.track !== null;
  const canTransport = hasTrack && state.duration > 0;

  const startNudge = (direction: 'forward' | 'back') => {
    if (!canTransport) return;
    onNudge(direction);
    nudgeIntervalRef.current = setInterval(() => onNudge(direction), 80);
  };

  const stopNudge = () => {
    if (nudgeIntervalRef.current) {
      clearInterval(nudgeIntervalRef.current);
      nudgeIntervalRef.current = null;
    }
    onNudgeEnd();
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '16px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        backdropFilter: 'blur(12px)',
        minWidth: 0,
      }}
    >
      {/* Header: Deck label + Track info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: '13px',
            fontWeight: 700,
            color: deckId === 'A' ? 'var(--deck-a)' : 'var(--deck-b)',
            background: deckId === 'A' ? 'rgba(255,107,138,0.12)' : 'rgba(92,200,255,0.12)',
            padding: '2px 8px',
            borderRadius: '4px',
          }}
        >
          {deckId}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {hasTrack ? (
            <>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {state.track!.name}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {state.track!.artist}
              </div>
            </>
          ) : (
            <div
              style={{
                fontSize: '13px',
                color: 'var(--text-tertiary)',
                fontStyle: 'italic',
                whiteSpace: 'nowrap',
              }}
            >
              Drop a track
            </div>
          )}
        </div>
        {/* BPM display */}
        <span
          style={{
            fontFamily: 'ui-monospace, monospace',
            fontSize: '18px',
            fontWeight: 700,
            color: state.bpm > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
            letterSpacing: '-0.02em',
          }}
        >
          {state.bpm > 0 ? state.bpm.toFixed(1) : '---.-'}
        </span>
        {state.playbackRate !== 1 && (
          <span className="mono-readout">{state.playbackRate.toFixed(3)}x</span>
        )}
      </div>

      {/* Waveform — peaks from Tone.js buffer, click to seek */}
      <Waveform
        peaks={state.peaks}
        progress={state.duration > 0 ? state.currentTime / state.duration : 0}
        color={deckId === 'A' ? '#ff6b8a' : '#5cc8ff'}
        height={80}
        onSeek={onSeek}
      />

      {/* Play/Pause + Nudge row */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
        {/* Nudge back */}
        <button
          onMouseDown={() => startNudge('back')}
          onMouseUp={stopNudge}
          onMouseLeave={stopNudge}
          disabled={!canTransport}
          title="Hold to nudge back (slow down temporarily)"
          style={{
            width: '36px', height: '36px', borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-secondary)',
            cursor: canTransport ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: canTransport ? 1 : 0.3,
            fontSize: '14px',
            userSelect: 'none',
          }}
        >
          {'<<'}
        </button>

        <button
          data-tutorial={`deck-${deckId.toLowerCase()}-play`}
          onClick={onPlayPause}
          onMouseEnter={() => setHoverPlay(true)}
          onMouseLeave={() => setHoverPlay(false)}
          disabled={!canTransport}
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            border: state.isPlaying
              ? '2px solid var(--accent)'
              : '2px solid var(--border)',
            background: state.isPlaying
              ? 'var(--accent)'
              : hoverPlay && canTransport
                ? 'rgba(167,139,250,0.15)'
                : 'var(--surface)',
            color: state.isPlaying ? '#fff' : 'var(--text-secondary)',
            cursor: canTransport ? 'pointer' : 'not-allowed',
            transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
            boxShadow: state.isPlaying ? '0 0 20px var(--accent-glow)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            opacity: canTransport ? 1 : 0.4,
          }}
        >
          {state.isPlaying ? (
            // Pause icon
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <rect x="4" y="3" width="3.5" height="12" rx="1" />
              <rect x="10.5" y="3" width="3.5" height="12" rx="1" />
            </svg>
          ) : (
            // Play icon
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M5 3.5l10 5.5-10 5.5V3.5z" />
            </svg>
          )}
        </button>

        {/* Nudge forward */}
        <button
          onMouseDown={() => startNudge('forward')}
          onMouseUp={stopNudge}
          onMouseLeave={stopNudge}
          disabled={!canTransport}
          title="Hold to nudge forward (speed up temporarily)"
          style={{
            width: '36px', height: '36px', borderRadius: '50%',
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text-secondary)',
            cursor: canTransport ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: canTransport ? 1 : 0.3,
            fontSize: '14px',
            userSelect: 'none',
          }}
        >
          {'>>'}
        </button>
      </div>

      {/* Stem Toggles */}
      <StemToggles stems={state.stems} onToggle={onStemToggle} deckId={deckId} />

      {/* EQ + Volume row */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
        {/* EQ Section */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            gap: '8px',
            justifyContent: 'center',
            padding: '8px',
            background: 'var(--surface)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          {(['high', 'mid', 'low'] as const).map((band) => (
            <div
              key={band}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                height: '80px',
              }}
            >
              <span
                style={{
                  fontSize: '9px',
                  fontFamily: 'ui-monospace, monospace',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {band === 'high' ? 'hi' : band === 'low' ? 'lo' : 'mid'}
              </span>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <input
                  type="range"
                  className="eq-slider"
                  min={-12}
                  max={12}
                  step={0.5}
                  value={state.eq[band]}
                  onChange={(e) => onEQChange(band, parseFloat(e.target.value))}
                  style={{ height: '50px' }}
                />
              </div>
              <span
                style={{
                  fontSize: '9px',
                  fontFamily: 'ui-monospace, monospace',
                  color: 'var(--text-tertiary)',
                }}
              >
                {state.eq[band] > 0 ? '+' : ''}{state.eq[band].toFixed(0)}
              </span>
            </div>
          ))}
        </div>

        {/* Volume fader */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '8px',
            background: 'var(--surface)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            height: '100px',
          }}
        >
          <span
            style={{
              fontSize: '9px',
              fontFamily: 'ui-monospace, monospace',
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            VOL
          </span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <input
              type="range"
              className="vertical-slider"
              min={0}
              max={1}
              step={0.01}
              value={state.volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              style={{ height: '60px' }}
            />
          </div>
          <span
            style={{
              fontSize: '9px',
              fontFamily: 'ui-monospace, monospace',
              color: 'var(--text-tertiary)',
            }}
          >
            {Math.round(state.volume * 100)}
          </span>
        </div>
      </div>
    </div>
  );
}
