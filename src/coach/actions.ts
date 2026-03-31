/**
 * Maps coach action names to executable functions.
 * The executeAction callback bridges to the audio engine's actual controls.
 */
export function createCoachActions(
  executeAction: (name: string, ...args: unknown[]) => void,
): Record<string, () => void> {
  return {
    'cutBass:A': () => executeAction('setEQ', 'A', 'low', -24),
    'cutBass:B': () => executeAction('setEQ', 'B', 'low', -24),
    'muteVocals:A': () => executeAction('muteStem', 'A', 'vocals'),
    'muteVocals:B': () => executeAction('muteStem', 'B', 'vocals'),
    sync: () => executeAction('syncBPM'),
    startPlayAndCrossfade: () => executeAction('startPlayAndCrossfade'),
  }
}
