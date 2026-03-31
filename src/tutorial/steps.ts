// ---------------------------------------------------------------------------
// mixpilot – Tutorial step definitions
// ---------------------------------------------------------------------------

export interface TutorialStep {
  id: number;
  title: string;
  message: string;
  /** CSS selector for the element to spotlight. null = no highlight. */
  highlight: string | null;
  /** Keyboard key hint to render as a keycap visual. */
  keyHint: string | null;
  /** Describes the condition that auto-advances to the next step. */
  detectAdvance: string;
  /** Track suggestions shown as secondary text. */
  suggestions: string[];
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    title: 'Welcome to mixpilot',
    message:
      "You're about to make your first mix. I'll walk you through it. No experience needed — you've got ears, that's enough.",
    highlight: null,
    keyHint: null,
    detectAdvance: 'click-lets-go',
    suggestions: [],
  },
  {
    id: 2,
    title: 'Load your first track',
    message:
      'Click any track in the library on the left to load it onto Deck A. Pick something you like — a rap track with a strong beat works great.',
    highlight: '[data-tutorial="library"]',
    keyHint: null,
    detectAdvance: 'deck-a-loaded',
    suggestions: [],
  },
  {
    id: 3,
    title: 'Hit play',
    message: 'Press SPACE or click the play button to hear your track.',
    highlight: '[data-tutorial="deck-a-play"]',
    keyHint: 'SPACE',
    detectAdvance: 'deck-a-playing',
    suggestions: [],
  },
  {
    id: 4,
    title: 'Now load a second track',
    message:
      "Click another track to load it on Deck B. Try a house track — the magic happens when you blend genres.",
    highlight: '[data-tutorial="library"]',
    keyHint: null,
    detectAdvance: 'deck-b-loaded',
    suggestions: [
      'Disclosure - When A Fire Starts To Burn',
      'Kaytranada - TRACK UNO',
    ],
  },
  {
    id: 5,
    title: 'Play both tracks',
    message:
      "Press ENTER to start Deck B. Both tracks will auto-sync to the same BPM.",
    highlight: '[data-tutorial="deck-b-play"]',
    keyHint: 'ENTER',
    detectAdvance: 'both-playing',
    suggestions: [],
  },
  {
    id: 6,
    title: 'Use the crossfader',
    message:
      'Drag the crossfader or scroll your mouse wheel over the mixer to blend between the two tracks. Slide right for more Deck B, left for more Deck A.',
    highlight: '[data-tutorial="crossfader"]',
    keyHint: null,
    detectAdvance: 'crossfader-moved',
    suggestions: [],
  },
  {
    id: 7,
    title: 'Try the stem trick',
    message:
      "This is where it gets fun. Press Q to mute the vocals on Deck A. Now you're hearing Deck A's beat with Deck B's vocals on top.",
    highlight: '[data-tutorial="stems-a"]',
    keyHint: 'Q',
    detectAdvance: 'stem-toggled',
    suggestions: [],
  },
  {
    id: 8,
    title: 'Play with the stems',
    message:
      'Each key controls a different part of the track:\n  Q = vocals, W = drums, E = bass, R = other (Deck A)\n  U = vocals, I = drums, O = bass, P = other (Deck B)\nTry muting Deck A\'s drums (W) and keeping Deck B\'s drums. Mix and match!',
    highlight: '[data-tutorial="stems-a"],[data-tutorial="stems-b"]',
    keyHint: null,
    detectAdvance: 'stems-explored',
    suggestions: [],
  },
  {
    id: 9,
    title: 'Make a transition',
    message:
      'Now slowly slide the crossfader all the way to Deck B. You just made your first transition.',
    highlight: '[data-tutorial="crossfader"]',
    keyHint: null,
    detectAdvance: 'crossfader-full-b',
    suggestions: [],
  },
  {
    id: 10,
    title: "You're a DJ now",
    message:
      "That's it. You just mixed two tracks together. Load new tracks, experiment with stems, and trust your ears. The coach will keep giving you tips as you go.",
    highlight: null,
    keyHint: null,
    detectAdvance: 'click-done',
    suggestions: [],
  },
];
