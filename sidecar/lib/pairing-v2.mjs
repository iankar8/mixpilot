import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const CANDIDATE_PATH = path.join(os.homedir(), '.mixmash', 'mashup-candidates.json');

export const candidateJob = {
  running: false,
  total: 0,
  completed: 0,
  candidateCount: 0,
  error: null,
  startedAt: null,
  updatedAt: null,
  source: 'deterministic',
};

const GENRES = {
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
  'Barry Cant Swim': 'house',
  'Bicep': 'house',
  'Black Coffee': 'house',
  'CamelPhat': 'house',
  'Channel Tres': 'crossover',
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
  'Kaytranada': 'crossover',
  'MK': 'house',
  'Modjo': 'house',
  'Overmono': 'house',
  'Peggy Gou': 'house',
  'Rufus Du Sol': 'house',
  'Vintage Culture': 'house',
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function genre(track) {
  return GENRES[track.artist] || 'rap';
}

function resolvedBpm(analysis) {
  return Number(analysis?.bpm?.resolved || analysis?.bpm || 128);
}

function nearestTempoPlan(aBpm, bBpm) {
  const targets = [
    { target: aBpm, aRate: 1, bRate: aBpm / bBpm },
    { target: bBpm, aRate: bBpm / aBpm, bRate: 1 },
    { target: (aBpm + bBpm) / 2, aRate: ((aBpm + bBpm) / 2) / aBpm, bRate: ((aBpm + bBpm) / 2) / bBpm },
  ];
  const sane = targets.filter((item) => item.aRate >= 0.78 && item.aRate <= 1.22 && item.bRate >= 0.78 && item.bRate <= 1.22);
  return sane.sort((left, right) => Math.abs(1 - left.aRate) + Math.abs(1 - left.bRate) - (Math.abs(1 - right.aRate) + Math.abs(1 - right.bRate)))[0] || targets[0];
}

function pickWindow(windows, fallback = 0) {
  if (!Array.isArray(windows) || windows.length === 0) return { start: fallback, end: fallback + 16, score: 0.2 };
  return [...windows].sort((left, right) => right.score - left.score)[0];
}

function pickSection(analysis, labels, fallback = 0) {
  const sections = analysis.sectionCandidates || [];
  const match = sections.filter((section) => labels.includes(section.label)).sort((left, right) => right.score - left.score)[0];
  return match || sections[1] || sections[0] || { start: fallback, end: fallback + 16, score: 0.2, label: 'phrase' };
}

function phraseSnap(time, analysis) {
  const phrases = analysis.phrases || [];
  if (!phrases.length) return Math.max(0, Number(time || 0));
  return phrases.reduce((best, next) => (Math.abs(next - time) < Math.abs(best - time) ? next : best), phrases[0]);
}

function compatibleKeyRisk(a, b) {
  const ak = a.roughKey;
  const bk = b.roughKey;
  if (!ak?.key || !bk?.key || ak.confidence < 0.2 || bk.confidence < 0.2) return 0.35;
  return ak.key === bk.key ? 0.12 : 0.46;
}

function vocalOverlapRisk(lead, bed) {
  const leadActivity = lead.stemEnergy?.vocals?.activity || 0;
  const bedActivity = bed.stemEnergy?.vocals?.activity || 0;
  return clamp((bedActivity - 0.18) * 1.4 + (leadActivity < 0.08 ? 0.28 : 0), 0, 0.85);
}

function bassClashRisk(a, b) {
  const aBass = a.stemEnergy?.bass?.activity || 0;
  const bBass = b.stemEnergy?.bass?.activity || 0;
  return clamp(aBass * bBass * 1.2, 0, 0.9);
}

function stemScore(analysis) {
  const availability = analysis.stemAvailability || {};
  const count = ['vocals', 'drums', 'bass', 'other'].filter((stem) => availability[stem]).length;
  return count / 4;
}

function chooseRoles(trackA, trackB, analysisA, analysisB) {
  const aVocal = analysisA.stemEnergy?.vocals?.activity || 0;
  const bVocal = analysisB.stemEnergy?.vocals?.activity || 0;
  const aGenre = genre(trackA);
  const bGenre = genre(trackB);
  if (aGenre === 'rap' && bGenre !== 'rap') return { lead: 'A', bed: 'B' };
  if (bGenre === 'rap' && aGenre !== 'rap') return { lead: 'B', bed: 'A' };
  return aVocal >= bVocal ? { lead: 'A', bed: 'B' } : { lead: 'B', bed: 'A' };
}

function scene(id, name, description, keyHint, pair, stemsA, stemsB, crossfader, events = []) {
  return {
    id,
    name,
    description,
    keyHint,
    deckAStems: stemsA,
    deckBStems: stemsB,
    crossfader,
    transition: 'fade',
    startOffsets: { A: pair.deckAStart, B: pair.deckBStart },
    playbackRates: { A: pair.deckARate, B: pair.deckBRate },
    durationBars: 16,
    fadeBars: 4,
    events,
  };
}

function buildScenes(trackA, trackB, analysisA, analysisB, pair, roles) {
  const leadIsA = roles.lead === 'A';
  const leadTrack = leadIsA ? trackA : trackB;
  const bedTrack = leadIsA ? trackB : trackA;
  const leadStemsA = leadIsA
    ? { vocals: true, drums: false, bass: false, other: false }
    : { vocals: false, drums: true, bass: true, other: true };
  const leadStemsB = leadIsA
    ? { vocals: false, drums: true, bass: true, other: true }
    : { vocals: true, drums: false, bass: false, other: false };

  return [
    scene(
      `${pair.id}-lead-over-bed`,
      `${leadTrack.name} vocal bed`,
      `${leadTrack.artist} vocal locked over ${bedTrack.artist}'s drums and low end.`,
      '1',
      pair,
      leadStemsA,
      leadStemsB,
      leadIsA ? 0.42 : 0.62,
      [
        { id: 'thin-bed-vocal', atBar: 1, deck: roles.bed, action: 'setStem', stem: 'vocals', active: false },
        { id: 'handoff-bass', atBar: 9, deck: roles.lead, action: 'setStem', stem: 'bass', active: false },
      ],
    ),
    scene(
      `${pair.id}-drum-swap`,
      'Drum swap',
      `Phrase-synced drums first, then bring the vocal through after the groove lands.`,
      '2',
      pair,
      { vocals: leadIsA, drums: !leadIsA, bass: !leadIsA, other: false },
      { vocals: !leadIsA, drums: leadIsA, bass: leadIsA, other: false },
      0.5,
      [
        { id: 'open-vocal', atBar: 5, deck: roles.lead, action: 'setStem', stem: 'vocals', active: true },
        { id: 'move-fader', atBar: 9, action: 'setCrossfader', value: leadIsA ? 0.38 : 0.68 },
      ],
    ),
    scene(
      `${pair.id}-breakdown-lift`,
      'Breakdown lift',
      `Strip the low end for eight bars, then punch the stronger bass back in.`,
      '3',
      pair,
      { vocals: leadIsA, drums: false, bass: false, other: true },
      { vocals: !leadIsA, drums: false, bass: false, other: true },
      0.5,
      [
        { id: 'bring-drums', atBar: 5, deck: roles.bed, action: 'setStem', stem: 'drums', active: true },
        { id: 'bring-bass', atBar: 9, deck: roles.bed, action: 'setStem', stem: 'bass', active: true },
      ],
    ),
    scene(
      `${pair.id}-full-merge`,
      'Full merge',
      `The most maximal version; keep one bass lane clean and use the fader as the performance control.`,
      '4',
      pair,
      { vocals: true, drums: true, bass: leadIsA, other: true },
      { vocals: true, drums: true, bass: !leadIsA, other: true },
      0.5,
      [
        { id: 'settle-fader', atBar: 13, action: 'setCrossfader', value: leadIsA ? 0.44 : 0.58 },
      ],
    ),
  ];
}

function candidateFromPair(trackA, trackB, analysisA, analysisB) {
  const aBpm = resolvedBpm(analysisA);
  const bBpm = resolvedBpm(analysisB);
  const tempo = nearestTempoPlan(aBpm, bBpm);
  const roles = chooseRoles(trackA, trackB, analysisA, analysisB);
  const leadAnalysis = roles.lead === 'A' ? analysisA : analysisB;
  const bedAnalysis = roles.bed === 'A' ? analysisA : analysisB;
  const leadWindow = pickWindow(leadAnalysis.vocalWindows, pickSection(leadAnalysis, ['hook', 'phrase']).start);
  const bedSection = pickSection(bedAnalysis, ['drop', 'hook', 'phrase']);
  const leadStart = phraseSnap(leadWindow.start, leadAnalysis);
  const bedStart = phraseSnap(bedSection.start, bedAnalysis);
  const aStart = roles.lead === 'A' ? leadStart : bedStart;
  const bStart = roles.lead === 'B' ? leadStart : bedStart;
  const keyRisk = compatibleKeyRisk(analysisA, analysisB);
  const bassRisk = bassClashRisk(analysisA, analysisB);
  const vocalRisk = vocalOverlapRisk(leadAnalysis, bedAnalysis);
  const tempoStretchPenalty = Math.abs(1 - tempo.aRate) + Math.abs(1 - tempo.bRate);
  const genreBonus = genre(trackA) !== genre(trackB) ? 0.08 : 0.03;
  const phraseScore = Math.max(0, 1 - Math.abs((aStart % (60 / tempo.target)) - (bStart % (60 / tempo.target))));
  const stemQuality = (stemScore(analysisA) + stemScore(analysisB)) / 2;
  const confidence = Math.min(analysisA.confidence || 0.4, analysisB.confidence || 0.4);
  const score = clamp(
    0.28
      + confidence * 0.22
      + stemQuality * 0.22
      + phraseScore * 0.12
      + genreBonus
      - tempoStretchPenalty * 0.28
      - bassRisk * 0.12
      - vocalRisk * 0.14
      - keyRisk * 0.06,
    0,
    0.98,
  );

  const pair = {
    id: `${trackA.id}-${trackB.id}-${Math.round(tempo.target)}`,
    targetBpm: Number(tempo.target.toFixed(2)),
    deckARate: Number(tempo.aRate.toFixed(4)),
    deckBRate: Number(tempo.bRate.toFixed(4)),
    deckAStart: Number(aStart.toFixed(3)),
    deckBStart: Number(bStart.toFixed(3)),
    durationBars: 16,
    confidence: Number(confidence.toFixed(3)),
    phraseMatch: Number(phraseScore.toFixed(3)),
    bassClashRisk: Number(bassRisk.toFixed(3)),
    vocalOverlapRisk: Number(vocalRisk.toFixed(3)),
    harmonicRisk: Number(keyRisk.toFixed(3)),
  };

  const warnings = [];
  if (tempoStretchPenalty > 0.18) warnings.push('Tempo stretch is noticeable.');
  if (bassRisk > 0.45) warnings.push('Bass handoff required.');
  if (vocalRisk > 0.42) warnings.push('Mute one vocal lane during the blend.');
  if (confidence < 0.62) warnings.push('Analysis confidence is medium; trust ears.');

  return {
    id: pair.id,
    title: `${trackA.artist} × ${trackB.artist}`,
    subtitle: `${trackA.name} / ${trackB.name}`,
    rationale: `${roles.lead === 'A' ? trackA.name : trackB.name} supplies the lead vocal while ${roles.bed === 'A' ? trackA.name : trackB.name} carries the groove.`,
    tags: [genre(trackA), genre(trackB), `${Math.round(pair.targetBpm)} BPM`].filter(Boolean),
    score: Number(score.toFixed(3)),
    scoreBreakdown: {
      confidence: Number(confidence.toFixed(3)),
      stemQuality: Number(stemQuality.toFixed(3)),
      phraseScore: Number(phraseScore.toFixed(3)),
      bassRisk: Number(bassRisk.toFixed(3)),
      vocalRisk: Number(vocalRisk.toFixed(3)),
      harmonicRisk: Number(keyRisk.toFixed(3)),
    },
    trackA,
    trackB,
    analysisA,
    analysisB,
    pair,
    scenes: buildScenes(trackA, trackB, analysisA, analysisB, pair, roles),
    warnings,
    source: 'deterministic-v2',
  };
}

export async function readCandidateCache() {
  try {
    const raw = await fs.readFile(CANDIDATE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.version === 1 && Array.isArray(parsed.candidates)) return parsed;
  } catch {
    // Missing cache is fine.
  }
  return { version: 1, updatedAt: null, candidates: [] };
}

export async function saveCandidateCache(candidates, source = 'deterministic') {
  await fs.mkdir(path.dirname(CANDIDATE_PATH), { recursive: true });
  const payload = {
    version: 1,
    source,
    updatedAt: new Date().toISOString(),
    candidates,
  };
  await fs.writeFile(CANDIDATE_PATH, JSON.stringify(payload, null, 2));
  return payload;
}

export async function prepareCandidates(tracks, analysisCache, { minScore = 0.54, limit = 12 } = {}) {
  candidateJob.running = true;
  candidateJob.total = tracks.length * tracks.length;
  candidateJob.completed = 0;
  candidateJob.error = null;
  candidateJob.startedAt = new Date().toISOString();
  candidateJob.updatedAt = candidateJob.startedAt;
  candidateJob.source = 'deterministic';

  try {
    const byId = Object.fromEntries(tracks.map((track) => [track.id, track]));
    const candidates = [];

    for (let i = 0; i < tracks.length; i += 1) {
      for (let j = i + 1; j < tracks.length; j += 1) {
        const trackA = byId[tracks[i].id];
        const trackB = byId[tracks[j].id];
        const analysisA = analysisCache.tracks[trackA.id];
        const analysisB = analysisCache.tracks[trackB.id];
        candidateJob.completed += 1;
        if (!analysisA || !analysisB) continue;
        const candidate = candidateFromPair(trackA, trackB, analysisA, analysisB);
        if (candidate.score >= minScore) candidates.push(candidate);
      }
    }

    candidates.sort((left, right) => right.score - left.score);
    const selected = candidates.slice(0, limit);
    candidateJob.candidateCount = selected.length;
    candidateJob.updatedAt = new Date().toISOString();
    return saveCandidateCache(selected, 'deterministic-v2');
  } catch (error) {
    candidateJob.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    candidateJob.running = false;
    candidateJob.updatedAt = new Date().toISOString();
  }
}
