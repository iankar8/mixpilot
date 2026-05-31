import type { MashupAnalysis, MashupScene, Track } from './types';

const allOff = { vocals: false, drums: false, bass: false, other: false };

export function generateMashupScenes(
  analysis: MashupAnalysis | null,
  trackA: Track | null,
  trackB: Track | null,
): MashupScene[] {
  if (!trackA || !trackB) return [];

  const a = trackA.name;
  const b = trackB.name;
  const syncWord = analysis?.status === 'synced' ? 'locked' : 'ready';

  return [
    {
      id: 'a-beat-b-vocal',
      name: 'A beat / B vocal',
      description: `${a} drums and low end under ${b} vocals.`,
      keyHint: '1',
      deckAStems: { vocals: false, drums: true, bass: true, other: false },
      deckBStems: { vocals: true, drums: false, bass: false, other: true },
      crossfader: 0.5,
      transition: 'cut',
    },
    {
      id: 'b-beat-a-vocal',
      name: 'B beat / A vocal',
      description: `${b} carries the groove while ${a} sits on top.`,
      keyHint: '2',
      deckAStems: { vocals: true, drums: false, bass: false, other: true },
      deckBStems: { vocals: false, drums: true, bass: true, other: false },
      crossfader: 0.5,
      transition: 'cut',
    },
    {
      id: 'chorus-lift',
      name: 'Chorus lift',
      description: `Both hooks up, drums focused, ${syncWord} at ${analysis?.targetBpm.toFixed(0) ?? '--'} BPM.`,
      keyHint: '3',
      deckAStems: { vocals: true, drums: true, bass: true, other: false },
      deckBStems: { vocals: true, drums: false, bass: false, other: true },
      crossfader: 0.44,
      transition: 'fade',
    },
    {
      id: 'breakdown-swap',
      name: 'Breakdown swap',
      description: `Pull the drums, swap texture, then punch the beat back in.`,
      keyHint: '4',
      deckAStems: { ...allOff, vocals: true, other: true },
      deckBStems: { ...allOff, vocals: false, bass: true, other: true },
      crossfader: 0.62,
      transition: 'fade',
    },
  ];
}
