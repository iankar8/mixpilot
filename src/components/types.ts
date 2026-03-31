// Re-export all types from the canonical source.
// Components should import from '../lib/types' directly,
// but this file prevents broken imports during migration.
export type {
  DeckId,
  Track,
  StemState,
  StemName,
  StemType,
  EQState,
  DeckState,
  MixerState,
  CoachSuggestion,
} from '../lib/types';
