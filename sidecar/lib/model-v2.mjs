import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const enrichmentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['candidates'],
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'rationale', 'tags'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          rationale: { type: 'string' },
          tags: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: { type: 'string' },
          },
        },
      },
    },
  },
};

function parseClaudeJson(stdout) {
  const parsed = JSON.parse(stdout);
  if (parsed?.candidates) return parsed;
  if (parsed?.structured_output?.candidates) return parsed.structured_output;
  if (typeof parsed?.result === 'object' && parsed.result?.candidates) return parsed.result;
  if (typeof parsed?.result === 'string') return JSON.parse(parsed.result);
  throw new Error('Claude response did not include candidates');
}

export async function enhanceCandidatesWithClaude(candidates, { claudeBin = 'claude', model = 'sonnet' } = {}) {
  if (!candidates.length) return candidates;

  const prompt = [
    'You are the creative arranger inside mixmash, a local AI-first mashup instrument.',
    'Local DSP already scored these candidates. Do not change IDs, scores, timings, stems, or scenes.',
    'Only improve the title, short rationale, and tags so the human can pick good mashups quickly.',
    'Be specific and musical. Avoid tutorial language and generic hype.',
    'Return JSON only.',
    '',
    JSON.stringify({
      candidates: candidates.slice(0, 8).map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        subtitle: candidate.subtitle,
        rationale: candidate.rationale,
        tags: candidate.tags,
        score: candidate.score,
        risks: candidate.scoreBreakdown,
        warnings: candidate.warnings,
      })),
    }, null, 2),
  ].join('\n');

  const { stdout } = await execFileAsync(
    claudeBin,
    [
      '-p',
      '--output-format',
      'json',
      '--json-schema',
      JSON.stringify(enrichmentSchema),
      '--model',
      model,
      '--no-session-persistence',
      '--disable-slash-commands',
      prompt,
    ],
    {
      timeout: 100_000,
      maxBuffer: 2 * 1024 * 1024,
      env: {
        ...process.env,
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      },
    },
  );

  const enriched = parseClaudeJson(stdout);
  const byId = new Map(enriched.candidates.map((candidate) => [candidate.id, candidate]));

  return candidates.map((candidate) => {
    const update = byId.get(candidate.id);
    if (!update) return candidate;
    return {
      ...candidate,
      title: String(update.title || candidate.title).slice(0, 80),
      rationale: String(update.rationale || candidate.rationale).slice(0, 260),
      tags: Array.isArray(update.tags) ? update.tags.slice(0, 4).map(String) : candidate.tags,
      source: 'claude-enriched-v2',
    };
  });
}
