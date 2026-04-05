// ---------------------------------------------------------------------------
// mixpilot – AI Assistant Panel (top bar)
// ---------------------------------------------------------------------------

import { useCoachStore } from '../stores/coach-store';

const TYPE_COLORS = {
  info: '#60a5fa',
  warning: '#f59e0b',
  success: '#a78bfa',
} as const;

export default function AIPanel() {
  const suggestions = useCoachStore((s) => s.suggestions);
  const dismissSuggestion = useCoachStore((s) => s.dismissSuggestion);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '0 20px',
        height: '56px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        background: 'var(--bg-panel)',
      }}
    >
      {/* Brand */}
      <span
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--accent)',
          letterSpacing: '0.15em',
          textTransform: 'lowercase',
          flexShrink: 0,
        }}
      >
        mixpilot
      </span>

      {/* Divider */}
      <div style={{ width: '1px', height: '24px', background: 'var(--border)', flexShrink: 0 }} />

      {/* Coach area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        {suggestions.length === 0 ? (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              fontStyle: 'italic',
            }}
          >
            Load tracks from the library and start mixing — your AI coach is watching
          </span>
        ) : (
          suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="coach-card-enter"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 12px',
                background: 'rgba(10,10,13,0.6)',
                backdropFilter: 'blur(12px)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${TYPE_COLORS[suggestion.type]}`,
                borderRadius: '8px',
                flexShrink: 0,
                maxWidth: '480px',
              }}
            >
              <span
                style={{
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  lineHeight: 1.3,
                }}
              >
                {suggestion.message}
              </span>

              {suggestion.action && (
                <button
                  onClick={suggestion.action}
                  style={{
                    padding: '3px 10px',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: '5px',
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
                  fontSize: '13px',
                  padding: '0 2px',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
