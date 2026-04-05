// ---------------------------------------------------------------------------
// mixpilot – Track recommendation engine
// ---------------------------------------------------------------------------
// Rule-based recommendations: BPM compatibility, genre crossover, and
// energy matching. No LLM calls — instant results from library metadata.
// ---------------------------------------------------------------------------

import type { Track } from './types';

// ---------------------------------------------------------------------------
// Genre / vibe tagging (hardcoded for our 90-track library)
// ---------------------------------------------------------------------------

type Genre = 'rap' | 'house' | 'crossover';

const ARTIST_GENRES: Record<string, Genre> = {
  // Rap
  'Amaarae': 'crossover',
  'Baby Keem': 'rap',
  'BIA': 'rap',
  'DaBaby': 'rap',
  'DDG': 'rap',
  'Don Toliver': 'rap',
  'Future': 'rap',
  'Gunna': 'rap',
  'J Cole': 'rap',
  'Kamaiyah': 'rap',
  'Ken Carson': 'rap',
  'Key Glock': 'rap',
  'Lackville': 'rap',
  'Larry June': 'rap',
  'Latto': 'rap',
  'Lil Uzi Vert': 'rap',
  'Lil Yachty': 'rap',
  'Metro Boomin': 'rap',
  'Mike WiLL Made-It': 'rap',
  'Monaleo': 'rap',
  'PARTYNEXTDOOR': 'crossover',
  'PinkPantheress': 'crossover',
  'PlaqueBoyMax': 'rap',
  'Playboi Carti': 'rap',
  'Sexyy Red': 'rap',
  'Shoreline Mafia': 'rap',
  'sosocamono': 'rap',
  'The Kid LAROI': 'rap',
  'Yeat': 'rap',
  'Young Nudy': 'rap',

  // House / Electronic
  'Barry Cant Swim': 'house',
  'Bicep': 'house',
  'Black Coffee': 'house',
  'CamelPhat': 'house',
  'Chris Lake': 'house',
  'Daft Punk': 'house',
  'Disclosure': 'house',
  'Dom Dolla': 'house',
  'Fisher': 'house',
  'Four Tet': 'house',
  'Fred again': 'house',
  'Guy Gerber': 'house',
  'Hot Since 82': 'house',
  'Jamie XX': 'house',
  'John Summit': 'house',
  'MK': 'house',
  'Modjo': 'house',
  'Overmono': 'house',
  'Peggy Gou': 'house',
  'Rufus Du Sol': 'house',
  'Vintage Culture': 'house',

  // Crossover (rap x house)
  'Channel Tres': 'crossover',
  'Kaytranada': 'crossover',
};

// Typical BPM ranges
export const BPM_ESTIMATES: Record<string, number> = {
  // Rap (typically 80-100 BPM, or 140-160 trap)
  'Baby Keem': 140, 'BIA': 130, 'DaBaby': 140, 'DDG': 130,
  'Don Toliver': 130, 'Future': 140, 'Gunna': 135, 'J Cole': 90,
  'Kamaiyah': 100, 'Ken Carson': 150, 'Key Glock': 140, 'Latto': 130,
  'Lil Uzi Vert': 155, 'Lil Yachty': 140, 'Metro Boomin': 140,
  'Mike WiLL Made-It': 140, 'Monaleo': 130, 'PARTYNEXTDOOR': 95,
  'PinkPantheress': 140, 'PlaqueBoyMax': 145, 'Playboi Carti': 150,
  'Sexyy Red': 130, 'Shoreline Mafia': 100, 'The Kid LAROI': 130,
  'Yeat': 150, 'Young Nudy': 135, 'Larry June': 90, 'Lackville': 140,
  'sosocamono': 130, 'Amaarae': 110,

  // House (typically 120-130 BPM)
  'Barry Cant Swim': 120, 'Bicep': 130, 'Black Coffee': 120,
  'CamelPhat': 124, 'Channel Tres': 120, 'Chris Lake': 126,
  'Daft Punk': 123, 'Disclosure': 128, 'Dom Dolla': 126,
  'Fisher': 126, 'Four Tet': 125, 'Fred again': 128,
  'Guy Gerber': 122, 'Hot Since 82': 124, 'Jamie XX': 128,
  'John Summit': 126, 'Kaytranada': 110, 'MK': 124,
  'Modjo': 122, 'Overmono': 130, 'Peggy Gou': 124,
  'Rufus Du Sol': 120, 'Vintage Culture': 126,
};

function getGenre(artist: string): Genre {
  return ARTIST_GENRES[artist] ?? 'rap';
}

function getEstimatedBPM(track: Track): number {
  return track.bpm || BPM_ESTIMATES[track.artist] || 128;
}

// ---------------------------------------------------------------------------
// Recommendation scoring
// ---------------------------------------------------------------------------

interface ScoredTrack {
  track: Track;
  score: number;
  reason: string;
}

/**
 * Given the currently loaded track, recommend tracks from the library
 * sorted by compatibility score.
 */
export function getRecommendations(
  currentTrack: Track,
  library: Track[],
  loadedTrackIds: string[] = [],
  limit = 5,
): ScoredTrack[] {
  const currentGenre = getGenre(currentTrack.artist);
  const currentBPM = getEstimatedBPM(currentTrack);

  const scored: ScoredTrack[] = [];

  for (const candidate of library) {
    // Skip the same track and already-loaded tracks
    if (candidate.id === currentTrack.id) continue;
    if (loadedTrackIds.includes(candidate.id)) continue;

    const candidateGenre = getGenre(candidate.artist);
    const candidateBPM = getEstimatedBPM(candidate);

    let score = 0;
    const reasons: string[] = [];

    // --- BPM compatibility ---
    const bpmDiff = Math.abs(currentBPM - candidateBPM);
    // Half-time / double-time compatibility
    const halfTimeDiff = Math.abs(currentBPM - candidateBPM * 2);
    const doubleTimeDiff = Math.abs(currentBPM * 2 - candidateBPM);
    const effectiveBPMDiff = Math.min(bpmDiff, halfTimeDiff, doubleTimeDiff);

    if (effectiveBPMDiff <= 3) {
      score += 40;
      reasons.push('BPM match');
    } else if (effectiveBPMDiff <= 8) {
      score += 25;
      reasons.push('close BPM');
    } else if (effectiveBPMDiff <= 15) {
      score += 10;
    }

    // --- Genre crossover bonus (the Kaytranada move) ---
    if (currentGenre === 'rap' && candidateGenre === 'house') {
      score += 30;
      reasons.push('rap × house');
    } else if (currentGenre === 'house' && candidateGenre === 'rap') {
      score += 30;
      reasons.push('house × rap');
    } else if (candidateGenre === 'crossover') {
      score += 25;
      reasons.push('crossover vibes');
    } else if (currentGenre === candidateGenre) {
      score += 15;
      reasons.push('same genre');
    }

    // --- Same artist penalty (mix it up) ---
    if (candidate.artist === currentTrack.artist) {
      score -= 10;
    }

    // --- Crossover artists always get a boost ---
    if (candidateGenre === 'crossover' && currentGenre !== 'crossover') {
      score += 10;
      if (!reasons.includes('crossover vibes')) reasons.push('crossover vibes');
    }

    // --- Kaytranada special: bridges everything ---
    if (candidate.artist === 'Kaytranada' || candidate.artist === 'Channel Tres') {
      score += 5;
    }

    if (score > 0) {
      scored.push({
        track: candidate,
        score,
        reason: reasons.slice(0, 2).join(' · ') || 'try it',
      });
    }
  }

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
