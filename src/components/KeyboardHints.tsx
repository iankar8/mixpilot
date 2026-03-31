import { useTutorialStore } from '../tutorial/tutorial-store';

const SHORTCUTS = [
  { key: 'SPACE', action: 'Play A' },
  { key: 'ENTER', action: 'Play B' },
  { key: 'Q W E R', action: 'Stems A' },
  { key: 'U I O P', action: 'Stems B' },
  { key: '\u2190 \u2192', action: 'Crossfader' },
  { key: 'TAB', action: 'Sync' },
];

export default function KeyboardHints() {
  const restartTutorial = useTutorialStore((s) => s.restartTutorial);
  const tutorialActive = useTutorialStore((s) => s.isActive);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 50,
        padding: '10px 12px',
        background: 'rgba(10, 10, 13, 0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      {SHORTCUTS.map((shortcut) => (
        <div
          key={shortcut.key}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              minWidth: '60px',
            }}
          >
            {shortcut.key}
          </span>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--text-tertiary)',
            }}
          >
            {shortcut.action}
          </span>
        </div>
      ))}
      {!tutorialActive && (
        <button
          onClick={restartTutorial}
          style={{
            marginTop: '6px',
            padding: '4px 8px',
            fontSize: '10px',
            color: 'var(--accent)',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Restart Tutorial
        </button>
      )}
    </div>
  );
}
