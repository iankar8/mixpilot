import { useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface WaveformProps {
  url?: string;
  color?: string;
  height?: number;
}

export default function Waveform({ url, color = '#a78bfa', height = 80 }: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: color,
      progressColor: color + 'cc',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      cursorColor: '#fff',
      cursorWidth: 1,
      height,
      normalize: true,
      fillParent: true,
      interact: true,
      hideScrollbar: true,
    });

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
    };
  }, [color, height]);

  useEffect(() => {
    if (!wavesurferRef.current || !url) return;
    wavesurferRef.current.load(url);
  }, [url]);

  return (
    <div
      style={{
        width: '100%',
        height: `${height}px`,
        borderRadius: '6px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Placeholder gradient when no URL loaded */}
      {!url && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(90deg, transparent 0%, ${color}15 20%, ${color}25 50%, ${color}15 80%, transparent 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontFamily: 'ui-monospace, monospace' }}>
            NO WAVEFORM
          </span>
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
