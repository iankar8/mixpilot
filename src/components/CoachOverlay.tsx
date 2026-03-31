import type { CoachSuggestion } from '../lib/types';
import { useCoachStore } from '../stores/coach-store';

const TYPE_COLORS: Record<CoachSuggestion['type'], string> = {
  info: '#60a5fa',
  warning: '#f59e0b',
  success: '#a78bfa',
};

export default function CoachOverlay() {
  const suggestions = useCoachStore((s) => s.suggestions);
  const dismissSuggestion = useCoachStore((s) => s.dismissSuggestion);

  if (suggestions.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 100,
        pointerEvents: 'none',
        maxWidth: '480px',
        width: '100%',
        padding: '0 16px',
      }}
    >
      {suggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          className="coach-card-enter"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 14px',
            background: 'rgba(10, 10, 13, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border)',
            borderLeft: `3px solid ${TYPE_COLORS[suggestion.type]}`,
            borderRadius: '8px',
            pointerEvents: 'auto',
          }}
        >
          <span
            style={{
              flex: 1,
              fontSize: '13px',
              color: 'var(--text-primary)',
              lineHeight: 1.4,
            }}
          >
            {suggestion.message}
          </span>

          {suggestion.action && (
            <button
              onClick={suggestion.action}
              style={{
                padding: '4px 12px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                flexShrink: 0,
              }}
            >
              {suggestion.actionLabel ?? 'DO IT'}
            </button>
          )}

          <button
            onClick={() => dismissSuggestion(suggestion.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '0 2px',
              lineHeight: 1,
              flexShrink: 0,
            }}
            aria-label="Dismiss"
          >
            x
          </button>
        </div>
      ))}
    </div>
  );
}
