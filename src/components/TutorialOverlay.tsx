// ---------------------------------------------------------------------------
// mixpilot – Tutorial overlay UI
// ---------------------------------------------------------------------------

import { useEffect, useState, useRef, useCallback } from 'react';
import { useTutorialStore } from '../tutorial/tutorial-store';
import { TUTORIAL_STEPS } from '../tutorial/steps';

/** Bounding rect for the spotlight cutout */
interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Position the card relative to the spotlight */
type CardPlacement = 'above' | 'below' | 'right' | 'left' | 'center';

// ---------------------------------------------------------------------------
// Keycap component — renders a keyboard key visual
// ---------------------------------------------------------------------------

function Keycap({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '28px',
        height: '28px',
        padding: '0 8px',
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderBottom: '3px solid rgba(255,255,255,0.12)',
        borderRadius: '5px',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '12px',
        fontWeight: 700,
        color: '#e4e4e7',
        letterSpacing: '0.05em',
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Spotlight backdrop — SVG with a cutout hole
// ---------------------------------------------------------------------------

function SpotlightBackdrop({
  rect,
  onClick,
}: {
  rect: SpotRect | null;
  onClick: () => void;
}) {
  // Padding around the highlighted element
  const pad = 8;

  return (
    <svg
      onClick={onClick}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9998,
        pointerEvents: 'none',
        cursor: 'default',
      }}
    >
      <defs>
        <mask id="tutorial-mask">
          <rect width="100%" height="100%" fill="white" />
          {rect && (
            <rect
              x={rect.left - pad}
              y={rect.top - pad}
              width={rect.width + pad * 2}
              height={rect.height + pad * 2}
              rx={12}
              ry={12}
              fill="black"
            />
          )}
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.65)"
        mask="url(#tutorial-mask)"
      />
      {/* Pulsing violet glow around the cutout */}
      {rect && (
        <rect
          x={rect.left - pad}
          y={rect.top - pad}
          width={rect.width + pad * 2}
          height={rect.height + pad * 2}
          rx={12}
          ry={12}
          fill="none"
          stroke="rgba(167,139,250,0.5)"
          strokeWidth={2}
          className="tutorial-spotlight-pulse"
        />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Card component — the tutorial message
// ---------------------------------------------------------------------------

function TutorialCard({
  stepIndex,
  totalSteps,
  placement,
  spotRect,
}: {
  stepIndex: number;
  totalSteps: number;
  placement: CardPlacement;
  spotRect: SpotRect | null;
}) {
  const step = TUTORIAL_STEPS[stepIndex];
  const nextStep = useTutorialStore((s) => s.nextStep);
  const completeTutorial = useTutorialStore((s) => s.completeTutorial);
  const dismissTutorial = useTutorialStore((s) => s.dismissTutorial);

  const isLast = stepIndex === totalSteps - 1;

  // Keyboard: Space or Enter to advance
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (isLast) {
          completeTutorial();
        } else {
          nextStep();
        }
      } else if (e.code === 'Escape') {
        e.preventDefault();
        dismissTutorial();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isLast, nextStep, completeTutorial, dismissTutorial]);

  if (!step) return null;

  // ---- Position calculation ----
  const cardWidth = 380;
  const gap = 16;
  let posStyle: React.CSSProperties;

  if (placement === 'center' || !spotRect) {
    posStyle = {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  } else if (placement === 'below') {
    posStyle = {
      top: spotRect.top + spotRect.height + gap,
      left: Math.max(
        16,
        Math.min(
          spotRect.left + spotRect.width / 2 - cardWidth / 2,
          window.innerWidth - cardWidth - 16,
        ),
      ),
    };
  } else if (placement === 'above') {
    posStyle = {
      bottom: window.innerHeight - spotRect.top + gap,
      left: Math.max(
        16,
        Math.min(
          spotRect.left + spotRect.width / 2 - cardWidth / 2,
          window.innerWidth - cardWidth - 16,
        ),
      ),
    };
  } else if (placement === 'right') {
    posStyle = {
      top: Math.max(16, spotRect.top),
      left: Math.min(
        spotRect.left + spotRect.width + gap,
        window.innerWidth - cardWidth - 16,
      ),
    };
  } else {
    // left
    posStyle = {
      top: Math.max(16, spotRect.top),
      left: Math.max(16, spotRect.left - cardWidth - gap),
    };
  }

  const isWelcome = step.id === 1;
  const isDone = step.id === 10;

  // Split message by newlines for stem layout step
  const messageLines = step.message.split('\n');

  return (
    <div
      className="tutorial-card-enter"
      key={step.id}
      style={{
        position: 'fixed',
        width: cardWidth,
        zIndex: 10000,
        ...posStyle,
      }}
    >
      <div
        style={{
          background: 'rgba(10, 10, 13, 0.92)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(167,139,250,0.25)',
          borderRadius: '14px',
          padding: '20px',
          boxShadow:
            '0 0 40px rgba(167,139,250,0.08), 0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Step counter */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}
        >
          <span
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '11px',
              color: '#a78bfa',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            Step {step.id} of {totalSteps}
          </span>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background:
                    i < step.id
                      ? '#a78bfa'
                      : i === step.id - 1
                        ? '#a78bfa'
                        : 'rgba(255,255,255,0.1)',
                  transition: 'background 300ms',
                }}
              />
            ))}
          </div>
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#e4e4e7',
            margin: '0 0 8px',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {step.title}
        </h3>

        {/* Message */}
        <div
          style={{
            fontSize: '13px',
            lineHeight: 1.55,
            color: '#a1a1aa',
            margin: '0 0 14px',
          }}
        >
          {messageLines.map((line, i) => (
            <div key={i} style={{ marginTop: i > 0 ? '4px' : 0 }}>
              {line}
            </div>
          ))}
        </div>

        {/* Key hint */}
        {step.keyHint && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '14px',
            }}
          >
            <Keycap label={step.keyHint} />
            <span
              style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}
            >
              press to continue
            </span>
          </div>
        )}

        {/* Track suggestions */}
        {step.suggestions.length > 0 && (
          <div
            style={{
              fontSize: '12px',
              color: '#a78bfa',
              marginBottom: '14px',
              fontStyle: 'italic',
            }}
          >
            Try: {step.suggestions.join(' or ')}
          </div>
        )}

        {/* Action buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={dismissTutorial}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '12px',
              cursor: 'pointer',
              padding: '4px 0',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Skip tutorial
          </button>

          <button
            onClick={isDone ? completeTutorial : nextStep}
            style={{
              padding: '8px 20px',
              background: '#a78bfa',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 150ms cubic-bezier(0.22, 1, 0.36, 1)',
              boxShadow: '0 0 16px rgba(167,139,250,0.3)',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {isWelcome ? "Let's go" : isDone ? 'Start mixing' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main overlay
// ---------------------------------------------------------------------------

export default function TutorialOverlay() {
  const isActive = useTutorialStore((s) => s.isActive);
  const currentStep = useTutorialStore((s) => s.currentStep);
  const totalSteps = useTutorialStore((s) => s.totalSteps);

  const [spotRect, setSpotRect] = useState<SpotRect | null>(null);
  const [placement, setPlacement] = useState<CardPlacement>('center');
  const rafRef = useRef(0);

  const stepDef = TUTORIAL_STEPS[currentStep - 1];

  // Measure the highlighted element and compute card placement
  const measure = useCallback(() => {
    if (!stepDef?.highlight) {
      setSpotRect(null);
      setPlacement('center');
      return;
    }

    // Support comma-separated selectors (for step 8 with two stem panels)
    const selectors = stepDef.highlight.split(',');
    let combinedRect: SpotRect | null = null;

    for (const sel of selectors) {
      const el = document.querySelector(sel.trim());
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (!combinedRect) {
        combinedRect = {
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        };
      } else {
        const right = Math.max(
          combinedRect.left + combinedRect.width,
          r.left + r.width,
        );
        const bottom = Math.max(
          combinedRect.top + combinedRect.height,
          r.top + r.height,
        );
        combinedRect.top = Math.min(combinedRect.top, r.top);
        combinedRect.left = Math.min(combinedRect.left, r.left);
        combinedRect.width = right - combinedRect.left;
        combinedRect.height = bottom - combinedRect.top;
      }
    }

    setSpotRect(combinedRect);

    if (!combinedRect) {
      setPlacement('center');
      return;
    }

    // Decide placement: prefer below, then right, then above, then left
    const spaceBelow =
      window.innerHeight - (combinedRect.top + combinedRect.height);
    const spaceRight =
      window.innerWidth - (combinedRect.left + combinedRect.width);
    const spaceAbove = combinedRect.top;

    if (spaceBelow > 200) {
      setPlacement('below');
    } else if (spaceRight > 420) {
      setPlacement('right');
    } else if (spaceAbove > 200) {
      setPlacement('above');
    } else {
      setPlacement('right');
    }
  }, [stepDef]);

  // Re-measure on step change and on window resize
  useEffect(() => {
    if (!isActive) return;

    // Initial measure (slight delay to let DOM settle after step change)
    const timeout = setTimeout(measure, 50);

    const handleResize = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [isActive, currentStep, measure]);

  if (!isActive || !stepDef) return null;

  return (
    <>
      <SpotlightBackdrop
        rect={spotRect}
        onClick={() => {
          /* prevent clicks from passing through the backdrop */
        }}
      />

      {/* Allow clicks inside the spotlight cutout to pass through */}
      {spotRect && (
        <div
          style={{
            position: 'fixed',
            top: spotRect.top - 8,
            left: spotRect.left - 8,
            width: spotRect.width + 16,
            height: spotRect.height + 16,
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        />
      )}

      <TutorialCard
        stepIndex={currentStep - 1}
        totalSteps={totalSteps}
        placement={placement}
        spotRect={spotRect}
      />
    </>
  );
}
