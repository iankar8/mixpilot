import type { MashupCandidate } from '../lib/types';

interface MashupInboxProps {
  candidates: MashupCandidate[];
  statusLabel: string;
  loadingCandidateId: string | null;
  onRefresh: () => void;
  onLoadCandidate: (candidate: MashupCandidate) => void;
}

function riskLabel(value: number): string {
  if (value < 0.24) return 'low';
  if (value < 0.48) return 'watch';
  return 'hot';
}

export default function MashupInbox({
  candidates,
  statusLabel,
  loadingCandidateId,
  onRefresh,
  onLoadCandidate,
}: MashupInboxProps) {
  return (
    <section className="mashup-inbox" aria-label="Mashup Inbox">
      <div className="inbox-hero">
        <div>
          <div className="section-kicker">mashup inbox</div>
          <h1>AI-prepped blends ready to play</h1>
          <p>
            Background analysis finds pairs, aligns phrase starts, maps scenes, and leaves
            the final feel to your hands.
          </p>
        </div>
        <div className="inbox-status">
          <span>{statusLabel}</span>
          <button className="ghost-button" onClick={onRefresh}>refresh</button>
        </div>
      </div>

      {candidates.length === 0 ? (
        <div className="inbox-empty">
          <strong>Preparing the crate.</strong>
          <span>Track analysis and candidate scoring run locally in the sidecar.</span>
        </div>
      ) : (
        <div className="candidate-grid">
          {candidates.map((candidate) => {
            const isLoading = loadingCandidateId === candidate.id;
            return (
              <button
                key={candidate.id}
                className="candidate-card"
                onClick={() => onLoadCandidate(candidate)}
                disabled={isLoading}
              >
                <span className="candidate-score">{Math.round(candidate.score * 100)}</span>
                <span className="candidate-copy">
                  <span className="candidate-title">{candidate.title}</span>
                  <span className="candidate-subtitle">{candidate.subtitle}</span>
                  <span className="candidate-rationale">{candidate.rationale}</span>
                </span>
                <span className="candidate-tags">
                  {candidate.tags.slice(0, 4).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </span>
                <span className="candidate-meter-row">
                  <span>phrase {Math.round(candidate.scoreBreakdown.phraseScore * 100)}</span>
                  <span>bass {riskLabel(candidate.scoreBreakdown.bassRisk)}</span>
                  <span>vox {riskLabel(candidate.scoreBreakdown.vocalRisk)}</span>
                </span>
                <span className="candidate-action">
                  {isLoading ? 'loading session' : 'load synced session'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
