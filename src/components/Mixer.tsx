import { useState } from 'react';
import type { MixerState } from './types';

interface MixerProps {
  state: MixerState;
  bpmA: number;
  bpmB: number;
  onCrossfaderChange: (value: number) => void;
  onMasterVolumeChange: (value: number) => void;
  onSync: () => void;
}

export default function Mixer({
  state,
  bpmA,
  bpmB,
  onCrossfaderChange,
  onMasterVolumeChange,
  onSync,
}: MixerProps) {
  const [syncHover, setSyncHover] = useState(false);

  return (
    <div
      style={{
        width: '120px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px 12px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        backdropFilter: 'blur(12px)',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      {/* BPM displays */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 6px',
            background: 'var(--surface)',
            borderRadius: '6px',
            border: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>A</span>
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '13px',
              fontWeight: 700,
              color: bpmA > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}
          >
            {bpmA > 0 ? bpmA.toFixed(0) : '---'}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 6px',
            background: 'var(--surface)',
            borderRadius: '6px',
            border: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 600 }}>B</span>
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '13px',
              fontWeight: 700,
              color: bpmB > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}
          >
            {bpmB > 0 ? bpmB.toFixed(0) : '---'}
          </span>
        </div>
      </div>

      {/* Sync button */}
      <button
        onClick={onSync}
        onMouseEnter={() => setSyncHover(true)}
        onMouseLeave={() => setSyncHover(false)}
        style={{
          width: '100%',
          padding: '6px 0',
          border: '1px solid var(--accent)',
          borderRadius: '6px',
          background: syncHover ? 'rgba(167,139,250,0.15)' : 'transparent',
          color: 'var(--accent)',
          cursor: 'pointer',
          transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
          fontSize: '11px',
          fontWeight: 700,
          fontFamily: 'ui-monospace, monospace',
          letterSpacing: '0.1em',
        }}
      >
        SYNC
      </button>

      {/* Master volume */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          flex: 1,
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
          MASTER
        </span>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', minHeight: '80px' }}>
          <input
            type="range"
            className="vertical-slider"
            min={0}
            max={1}
            step={0.01}
            value={state.masterVolume}
            onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
            style={{ height: '70px' }}
          />
        </div>
        <span
          style={{
            fontSize: '9px',
            fontFamily: 'ui-monospace, monospace',
            color: 'var(--text-tertiary)',
          }}
        >
          {Math.round(state.masterVolume * 100)}
        </span>
      </div>

      {/* Crossfader */}
      <div style={{ width: '100%' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '4px',
          }}
        >
          <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>A</span>
          <span style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 600 }}>B</span>
        </div>
        <input
          type="range"
          className="crossfader"
          min={-1}
          max={1}
          step={0.01}
          value={state.crossfader}
          onChange={(e) => onCrossfaderChange(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
}
