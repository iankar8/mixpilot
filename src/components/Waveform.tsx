// ---------------------------------------------------------------------------
// mixpilot – Custom canvas waveform
// ---------------------------------------------------------------------------
// Reads peaks directly from Tone.js buffers (no WaveSurfer, no double-load).
// Click anywhere to seek.
// ---------------------------------------------------------------------------

import { useRef, useEffect } from 'react';

interface WaveformProps {
  peaks?: number[];      // normalized 0–1 amplitude, one value per bar
  progress?: number;     // 0–1 playback position (currentTime / duration)
  color?: string;
  height?: number;
  onSeek?: (progress: number) => void;
}

export default function Waveform({
  peaks = [],
  progress = 0,
  color = '#a78bfa',
  height = 80,
  onSeek,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (peaks.length === 0) return;

    const barW = W / peaks.length;
    const progressX = Math.floor(progress * W);

    for (let i = 0; i < peaks.length; i++) {
      const amp = peaks[i];
      const x = Math.floor(i * barW);
      const barH = Math.max(2, amp * H * 0.88);
      const y = Math.floor((H - barH) / 2);
      const played = x < progressX;

      ctx.fillStyle = played ? color : color + '3a';
      ctx.fillRect(x, y, Math.max(1, Math.floor(barW) - 1), Math.ceil(barH));
    }

    // Playhead cursor
    if (progress > 0 && progress < 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(progressX - 1, 0, 2, H);
    }
  }, [peaks, progress, color, height]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek || peaks.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(p);
  };

  const hasPeaks = peaks.length > 0;

  return (
    <div
      style={{
        width: '100%',
        height: `${height}px`,
        borderRadius: '6px',
        overflow: 'hidden',
        position: 'relative',
        cursor: hasPeaks && onSeek ? 'pointer' : 'default',
      }}
    >
      {!hasPeaks && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(90deg, transparent 0%, ${color}12 20%, ${color}22 50%, ${color}12 80%, transparent 100%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              color: 'var(--text-tertiary)',
              fontSize: '12px',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            loading waveform...
          </span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={600}
        height={height}
        onClick={handleClick}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
