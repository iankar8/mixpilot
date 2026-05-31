import type { DeckState, MashupAnalysis, Track, TrackAnalysis } from './types';
import { STEM_TYPES } from './types';

const CACHE_PREFIX = 'mixmash.track-analysis.v1';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cacheKey(track: Track): string {
  return `${CACHE_PREFIX}:${track.id}:${track.filename}`;
}

function readCachedAnalysis(track: Track): TrackAnalysis | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(track));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrackAnalysis;
    if (parsed.trackId !== track.id || parsed.bpm <= 0) return null;
    return { ...parsed, source: 'cached-browser' };
  } catch {
    return null;
  }
}

function writeCachedAnalysis(track: Track, analysis: TrackAnalysis): void {
  try {
    window.localStorage.setItem(cacheKey(track), JSON.stringify(analysis));
  } catch {
    // Analysis is an optimization; the app should keep working without storage.
  }
}

function createMarkers(duration: number, beatPeriod: number, everyBeats: number): number[] {
  if (duration <= 0 || beatPeriod <= 0) return [];
  const markers: number[] = [];
  const step = beatPeriod * everyBeats;
  for (let time = 0; time <= duration; time += step) {
    markers.push(Number(time.toFixed(3)));
  }
  return markers;
}

export async function analyzeTrackForMashup(track: Track, deck: DeckState): Promise<TrackAnalysis> {
  const cached = readCachedAnalysis(track);
  if (cached && Math.abs(cached.duration - deck.duration) < 1) {
    return cached;
  }

  const bpm = track.bpm ?? deck.bpm ?? 128;
  const duration = deck.duration || track.duration || 0;
  const beatPeriod = bpm > 0 ? 60 / bpm : 0;
  const hasWaveform = deck.peaks.length > 0;
  const confidence = clamp((track.bpm ? 0.72 : 0.54) + (hasWaveform ? 0.14 : 0), 0.35, 0.92);

  const analysis: TrackAnalysis = {
    trackId: track.id,
    bpm,
    duration,
    beatPeriod,
    downbeats: createMarkers(duration, beatPeriod, 4),
    phrases: createMarkers(duration, beatPeriod, 16),
    stemAvailability: STEM_TYPES.reduce(
      (acc, stem) => ({ ...acc, [stem]: true }),
      {} as TrackAnalysis['stemAvailability'],
    ),
    confidence,
    source: 'estimate',
    analyzedAt: Date.now(),
  };

  writeCachedAnalysis(track, analysis);
  return analysis;
}

export function buildMashupAnalysis(
  deckA: DeckState,
  deckB: DeckState,
  analysisA: TrackAnalysis,
  analysisB: TrackAnalysis,
): MashupAnalysis {
  const targetBpm = analysisA.bpm || deckA.bpm || 128;
  const deckARate = analysisA.bpm > 0 ? targetBpm / analysisA.bpm : 1;
  const deckBRate = analysisB.bpm > 0 ? targetBpm / analysisB.bpm : 1;
  const beatPeriodA = targetBpm > 0 ? 60 / targetBpm : 0.5;
  const beatPeriodBOriginal = analysisB.bpm > 0 ? 60 / analysisB.bpm : beatPeriodA;
  const phaseA = deckA.currentTime % beatPeriodA;
  const currentBeatB = Math.floor(deckB.currentTime / beatPeriodBOriginal);
  const phaseBTarget = phaseA * (analysisB.bpm / targetBpm);
  const deckBSeek = Math.max(0, currentBeatB * beatPeriodBOriginal + phaseBTarget);
  const tempoDelta = Math.abs(analysisA.bpm - analysisB.bpm);
  const confidencePenalty = tempoDelta > 18 ? 0.14 : tempoDelta > 10 ? 0.08 : 0;
  const confidence = clamp(Math.min(analysisA.confidence, analysisB.confidence) - confidencePenalty, 0.2, 0.96);
  const warnings: string[] = [];

  if (tempoDelta > 18) {
    warnings.push('Large tempo gap. Sync will work, but artifacts may feel obvious.');
  }
  if (analysisA.confidence < 0.65 || analysisB.confidence < 0.65) {
    warnings.push('Analysis confidence is low. Use nudge controls if the groove feels late.');
  }

  return {
    id: `${analysisA.trackId}:${analysisB.trackId}:${targetBpm.toFixed(2)}`,
    status: warnings.length ? 'warning' : 'ready',
    targetBpm,
    deckARate,
    deckBRate,
    deckBSeek,
    phaseOffsetSeconds: Number((deckBSeek - deckB.currentTime).toFixed(3)),
    phraseOffsetBeats: Math.round((deckBSeek - deckB.currentTime) / beatPeriodBOriginal),
    confidence,
    warnings,
  };
}
