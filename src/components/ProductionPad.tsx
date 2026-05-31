import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Tone from 'tone';
import { initAudio } from '../audio/engine';

interface ProductionPadProps {
  bpm: number;
}

const DEFAULT_PATTERN = [true, false, false, false, true, false, false, true, false, false, true, false, false, true, false, false];

export default function ProductionPad({ bpm }: ProductionPadProps) {
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const synthRef = useRef<Tone.MembraneSynth | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const safeBpm = bpm > 0 ? bpm : 128;
  const stepMs = useMemo(() => (60_000 / safeBpm) / 4, [safeBpm]);

  const triggerKick = useCallback(async (note = 'C1') => {
    await initAudio();
    if (!synthRef.current) {
      synthRef.current = new Tone.MembraneSynth({
        pitchDecay: 0.04,
        octaves: 6,
        envelope: { attack: 0.001, decay: 0.28, sustain: 0.02, release: 0.8 },
      }).toDestination();
    }
    synthRef.current.triggerAttackRelease(note, '8n');
  }, []);

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    intervalRef.current = setInterval(() => {
      setStep((current) => {
        const next = (current + 1) % pattern.length;
        if (pattern[next]) void triggerKick(next % 4 === 0 ? 'C1' : 'G1');
        return next;
      });
    }, stepMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pattern, playing, stepMs, triggerKick]);

  useEffect(
    () => () => {
      synthRef.current?.dispose();
    },
    [],
  );

  return (
    <section className="production-pad" aria-label="Production pad">
      <div className="panel-header">
        <div>
          <div className="section-kicker">production</div>
          <div className="panel-title">808 lane</div>
        </div>
        <button
          className={`transport-chip ${playing ? 'transport-chip-active' : ''}`}
          onClick={async () => {
            await initAudio();
            setPlaying((value) => !value);
          }}
        >
          {playing ? 'stop' : 'play'}
        </button>
      </div>

      <div className="pad-row">
        {['C1', 'G1', 'A#0'].map((note) => (
          <button key={note} className="drum-pad" onClick={() => void triggerKick(note)}>
            <span>808</span>
            <small>{note}</small>
          </button>
        ))}
      </div>

      <div className="step-grid">
        {pattern.map((active, index) => (
          <button
            key={index}
            className={`step-cell ${active ? 'step-cell-on' : ''} ${playing && step === index ? 'step-cell-current' : ''}`}
            onClick={() => {
              setPattern((current) => current.map((value, cell) => (cell === index ? !value : value)));
            }}
            aria-label={`Toggle step ${index + 1}`}
          />
        ))}
      </div>

      <div className="micro-label">{safeBpm.toFixed(0)} BPM · browser synth</div>
    </section>
  );
}
