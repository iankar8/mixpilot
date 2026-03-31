import type { DeckId, StemState, StemType } from '../lib/types';

interface StemTogglesProps {
  stems: StemState;
  onToggle: (stem: StemType) => void;
  deckId: DeckId;
}

const STEM_CONFIG: { key: StemType; label: string; hintsA: string; hintsB: string }[] = [
  { key: 'vocals', label: 'VOX', hintsA: 'Q', hintsB: 'U' },
  { key: 'drums', label: 'DRM', hintsA: 'W', hintsB: 'I' },
  { key: 'bass', label: 'BAS', hintsA: 'E', hintsB: 'O' },
  { key: 'other', label: 'OTH', hintsA: 'R', hintsB: 'P' },
];

export default function StemToggles({ stems, onToggle, deckId }: StemTogglesProps) {
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {STEM_CONFIG.map((stem) => {
        const active = stems[stem.key];
        const hint = deckId === 'A' ? stem.hintsA : stem.hintsB;

        return (
          <button
            key={stem.key}
            onClick={() => onToggle(stem.key)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              padding: '6px 0',
              border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: '6px',
              background: active ? 'var(--accent)' : 'var(--surface)',
              color: active ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
              boxShadow: active ? '0 0 12px var(--accent-glow)' : 'none',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: 'system-ui, sans-serif',
              letterSpacing: '0.05em',
            }}
          >
            <span>{stem.label}</span>
            <span
              style={{
                fontSize: '9px',
                fontFamily: 'ui-monospace, monospace',
                color: active ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)',
                fontWeight: 400,
              }}
            >
              {hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
