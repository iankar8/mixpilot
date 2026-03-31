// ---------------------------------------------------------------------------
// mixpilot – Tutorial Zustand store
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { TUTORIAL_STEPS } from './steps';

const STORAGE_KEY = 'mixpilot-tutorial-completed';

interface TutorialState {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  completed: boolean;
  stemToggles: number;

  startTutorial: () => void;
  nextStep: () => void;
  goToStep: (step: number) => void;
  completeTutorial: () => void;
  incrementStemToggles: () => void;
  dismissTutorial: () => void;
  restartTutorial: () => void;
}

function wasCompleted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export const useTutorialStore = create<TutorialState>()((set) => ({
  isActive: false,
  currentStep: 1,
  totalSteps: TUTORIAL_STEPS.length,
  completed: wasCompleted(),
  stemToggles: 0,

  startTutorial: () => {
    set({ isActive: true, currentStep: 1, stemToggles: 0 });
  },

  nextStep: () => {
    set((s) => {
      const next = s.currentStep + 1;
      if (next > s.totalSteps) {
        return s; // don't exceed — use completeTutorial instead
      }
      return { currentStep: next };
    });
  },

  goToStep: (step: number) => {
    set({ currentStep: Math.max(1, Math.min(step, TUTORIAL_STEPS.length)) });
  },

  completeTutorial: () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // localStorage unavailable — no-op
    }
    set({ isActive: false, completed: true });
  },

  incrementStemToggles: () => {
    set((s) => ({ stemToggles: s.stemToggles + 1 }));
  },

  dismissTutorial: () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // localStorage unavailable — no-op
    }
    set({ isActive: false, completed: true });
  },

  restartTutorial: () => {
    set({ isActive: true, currentStep: 1, stemToggles: 0, completed: false });
  },
}));
