import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const LIBRARY_ROOT = path.join(os.homedir(), 'Music', 'dj-library');
export const STEMS_ROOT = path.join(LIBRARY_ROOT, 'stems');
export const REMIX_CACHE_PATH = path.join(os.homedir(), '.mixmash', 'remix-analysis.json');
const WORKER_PATH = path.join(process.cwd(), 'sidecar', 'workers', 'analyze_track_v2.py');
const STEMS = ['vocals', 'drums', 'bass', 'other'];
const CLAUDE_PLAN_TIMEOUT_MS = 30_000;

function parseFilename(filename) {
  const base = filename.replace(/\.mp3$/i, '');
  const split = base.split(' - ');
  const artist = split.length > 1 ? split.shift() : 'Unknown Artist';
  return {
    id: base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    artist,
    name: split.length ? split.join(' - ') : base,
    filename,
  };
}

function stemDir(filename) {
  return path.join(STEMS_ROOT, filename.replace(/\.mp3$/i, ''));
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function statMtime(filePath) {
  const stat = await fs.stat(filePath).catch(() => null);
  return stat?.mtimeMs ?? 0;
}

async function probeDuration(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ], { timeout: 8_000, maxBuffer: 64 * 1024 });
    const duration = Number.parseFloat(stdout.trim());
    return Number.isFinite(duration) ? Number(duration.toFixed(3)) : 0;
  } catch {
    return 0;
  }
}

export async function listLibraryTracks({ artist } = {}) {
  const entries = await fs.readdir(LIBRARY_ROOT, { withFileTypes: true });
  const tracks = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.mp3')) continue;
    const track = parseFilename(entry.name);
    if (artist && track.artist.toLowerCase() !== String(artist).toLowerCase()) continue;
    const sourcePath = path.join(LIBRARY_ROOT, track.filename);
    tracks.push({
      ...track,
      duration: await probeDuration(sourcePath),
      hasStems: await hasAllStems(track.filename),
    });
  }

  return tracks.sort((a, b) => a.name.localeCompare(b.name));
}

async function hasAllStems(filename) {
  const dir = stemDir(filename);
  const checks = await Promise.all(STEMS.map((stem) => pathExists(path.join(dir, `${stem}.mp3`))));
  return checks.every(Boolean);
}

async function stemMtimes(filename) {
  const dir = stemDir(filename);
  const entries = {};
  for (const stem of STEMS) {
    entries[stem] = await statMtime(path.join(dir, `${stem}.mp3`));
  }
  return entries;
}

async function readRemixCache() {
  try {
    const raw = await fs.readFile(REMIX_CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.version === 1 && parsed.tracks) return parsed;
  } catch {
    // Cache miss is fine.
  }
  return { version: 1, updatedAt: null, tracks: {} };
}

async function saveRemixCache(cache) {
  await fs.mkdir(path.dirname(REMIX_CACHE_PATH), { recursive: true });
  cache.updatedAt = new Date().toISOString();
  await fs.writeFile(REMIX_CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function ensureStems(filename, { force = false } = {}) {
  const dir = stemDir(filename);
  if (!force && await hasAllStems(filename)) {
    return { ready: true, generated: false, stemDir: dir };
  }

  const sourcePath = path.join(LIBRARY_ROOT, filename);
  if (!await pathExists(sourcePath)) {
    throw new Error(`Track file not found: ${sourcePath}`);
  }

  await fs.mkdir(STEMS_ROOT, { recursive: true });
  if (force) await fs.rm(dir, { recursive: true, force: true });

  const { stdout, stderr } = await execFileAsync('uv', [
    'run',
    '--python',
    '3.13',
    '--with',
    'demucs',
    '--',
    'python3',
    '-m',
    'demucs',
    '--mp3',
    '-n',
    'htdemucs',
    '-o',
    STEMS_ROOT,
    sourcePath,
  ], {
    cwd: LIBRARY_ROOT,
    timeout: 12 * 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });

  const demucsDir = path.join(STEMS_ROOT, 'htdemucs', filename.replace(/\.mp3$/i, ''));
  if (!await pathExists(demucsDir)) {
    throw new Error(`Demucs did not create stems for ${filename}\n${stdout}\n${stderr}`);
  }

  await fs.rm(dir, { recursive: true, force: true });
  await fs.rename(demucsDir, dir);
  await fs.rmdir(path.join(STEMS_ROOT, 'htdemucs')).catch(() => {});

  if (!await hasAllStems(filename)) {
    throw new Error(`Stem preparation incomplete for ${filename}`);
  }

  return { ready: true, generated: true, stemDir: dir };
}

async function analyzeTrack(track) {
  const payload = JSON.stringify({ libraryRoot: LIBRARY_ROOT, track });
  const { stdout, stderr } = await runWithInput('python3', [WORKER_PATH], payload, {
    timeoutMs: 90_000,
    cwd: process.cwd(),
  });

  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`Could not parse remix analysis for ${track.filename}\n${stderr}`);
  }
}

async function runWithInput(command, args, input, { timeoutMs, cwd = process.cwd(), env = process.env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const chunks = [];
    const errors = [];
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${command} timed out`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => errors.push(chunk));
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      const stderrText = Buffer.concat(errors).toString('utf8');
      if (code !== 0) {
        reject(new Error(`${command} failed with exit ${code}\n${stderrText}`));
        return;
      }
      resolve({
        stdout: Buffer.concat(chunks).toString('utf8'),
        stderr: stderrText,
      });
    });
    child.stdin.end(input);
  });
}

function cacheValid(entry, sourceMtime, stems) {
  if (!entry?.analysis || !entry?.plan) return false;
  if (entry.sourceMtimeMs !== sourceMtime) return false;
  return STEMS.every((stem) => entry.stemMtimeMs?.[stem] === stems[stem]);
}

function pickWindow(windows = [], fallback = 0, minStart = 12) {
  const eligible = windows
    .filter((item) => item.start >= minStart)
    .sort((a, b) => b.score - a.score);
  return eligible[0] || windows[0] || { start: fallback, end: fallback + 8, score: 0.5 };
}

function pickSection(sections = [], labels, fallback = 0) {
  const eligible = sections
    .filter((item) => labels.includes(item.label) && item.start >= 8)
    .sort((a, b) => b.score - a.score);
  return eligible[0] || sections.find((item) => item.start >= 8) || { start: fallback, end: fallback + 8, label: 'phrase', score: 0.5 };
}

function pad(id, name, description, start, duration, stemMix, kind) {
  return {
    id,
    name,
    description,
    start: Number(Math.max(0, start).toFixed(3)),
    duration: Number(Math.max(2, duration).toFixed(3)),
    stemMix,
    loop: false,
    kind,
  };
}

function fallbackPlan(track, analysis) {
  const vocal = pickWindow(analysis.vocalWindows, 24);
  const secondVocal = pickWindow((analysis.vocalWindows || []).filter((item) => item.start !== vocal.start), 48);
  const drum = pickWindow(analysis.drumWindows, 16);
  const bass = pickWindow(analysis.bassWindows, drum.start);
  const hook = pickSection(analysis.hookCandidates, ['hook'], vocal.start);
  const drop = pickSection(analysis.dropCandidates, ['drop'], drum.start);
  const phrase = pickSection(analysis.sectionCandidates, ['phrase', 'intro', 'breakdown'], 8);
  const bar = 60 / Math.max(1, analysis.bpm?.resolved || 80) * 4;
  const twoBars = bar * 2;
  const fourBars = bar * 4;

  const pads = [
    pad('pad-1-vocal-anchor', 'Vocal anchor', 'Clean vocal phrase to build the remix around.', vocal.start, Math.min(8, vocal.end - vocal.start || twoBars), { vocals: true, drums: false, bass: false, other: false }, 'vocal'),
    pad('pad-2-hook-full', 'Hook full', 'Recognizable full-stem hook/phrase for orientation.', hook.start, Math.min(fourBars, hook.end - hook.start || fourBars), { vocals: true, drums: true, bass: true, other: true }, 'hook'),
    pad('pad-3-drums', 'Drums loop', 'Drum pocket for rebuilding the track.', drum.start, twoBars, { vocals: false, drums: true, bass: false, other: false }, 'drums'),
    pad('pad-4-bass', 'Bass pocket', 'Bass-only source for checking low-end identity.', bass.start, twoBars, { vocals: false, drums: false, bass: true, other: false }, 'bass'),
    pad('pad-5-bed', 'Drums + bass', 'Core groove without vocal clutter.', drop.start, Math.min(fourBars, drop.end - drop.start || fourBars), { vocals: false, drums: true, bass: true, other: false }, 'groove'),
    pad('pad-6-texture', 'Texture', 'Other stem as atmosphere or sample bed.', phrase.start, twoBars, { vocals: false, drums: false, bass: false, other: true }, 'texture'),
    pad('pad-7-second-vocal', 'Alt vocal', 'Second vocal phrase for variation or chops.', secondVocal.start, Math.min(8, secondVocal.end - secondVocal.start || twoBars), { vocals: true, drums: false, bass: false, other: false }, 'vocal'),
    pad('pad-8-break', 'Break idea', 'Sparse section for a breakdown or transition.', phrase.start, Math.min(fourBars, phrase.end - phrase.start || fourBars), { vocals: true, drums: false, bass: false, other: true }, 'breakdown'),
  ];

  return {
    source: 'local-fallback',
    anchorIdea: `Build the remix around the clearest vocal phrase in ${track.name}, then rebuild drums and bass underneath it instead of forcing another finished song underneath.`,
    moments: [
      { id: 'moment-vocal', label: 'Best vocal anchor', start: pads[0].start, end: pads[0].start + pads[0].duration, kind: 'vocal', confidence: vocal.score ?? 0.5 },
      { id: 'moment-hook', label: 'Recognizable full moment', start: pads[1].start, end: pads[1].start + pads[1].duration, kind: 'hook', confidence: hook.score ?? 0.5 },
      { id: 'moment-groove', label: 'Groove source', start: pads[4].start, end: pads[4].start + pads[4].duration, kind: 'groove', confidence: drop.score ?? 0.5 },
    ],
    pads,
    arrangement: [
      'Open with a dry vocal phrase.',
      'Bring in a new drum idea under the vocal.',
      'Use the original bass only as reference, not as the final low end.',
      'Drop into the recognizable hook after tension is established.',
    ],
    productionNotes: [
      'Do not use a full replacement beat yet; build a pocket around the vocal.',
      'Cut anything that fights the lead vocal.',
      'Treat the pads as source material for production, not finished scenes.',
    ],
  };
}

function coerceStemMix(value) {
  return {
    vocals: Boolean(value?.vocals),
    drums: Boolean(value?.drums),
    bass: Boolean(value?.bass),
    other: Boolean(value?.other),
  };
}

function normalizePlan(track, analysis, plan) {
  const fallback = fallbackPlan(track, analysis);
  const rawPads = Array.isArray(plan?.pads) ? plan.pads : [];
  const pads = rawPads.slice(0, 8).map((item, index) => ({
    id: String(item.id || `pad-${index + 1}`).toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    name: String(item.name || fallback.pads[index]?.name || `Pad ${index + 1}`).slice(0, 36),
    description: String(item.description || fallback.pads[index]?.description || '').slice(0, 160),
    start: Number(Math.max(0, Number(item.start ?? fallback.pads[index]?.start ?? 0)).toFixed(3)),
    duration: Number(Math.max(2, Number(item.duration ?? fallback.pads[index]?.duration ?? 6)).toFixed(3)),
    stemMix: coerceStemMix(item.stemMix || fallback.pads[index]?.stemMix),
    loop: Boolean(item.loop),
    kind: String(item.kind || fallback.pads[index]?.kind || 'moment').slice(0, 24),
  }));

  while (pads.length < 8) pads.push(fallback.pads[pads.length]);

  return {
    source: plan?.source || 'claude-cli',
    anchorIdea: String(plan?.anchorIdea || fallback.anchorIdea).slice(0, 420),
    moments: Array.isArray(plan?.moments) && plan.moments.length ? plan.moments.slice(0, 8) : fallback.moments,
    pads,
    arrangement: Array.isArray(plan?.arrangement) && plan.arrangement.length ? plan.arrangement.slice(0, 8).map(String) : fallback.arrangement,
    productionNotes: Array.isArray(plan?.productionNotes) && plan.productionNotes.length ? plan.productionNotes.slice(0, 8).map(String) : fallback.productionNotes,
  };
}

function parseClaudePlan(stdout) {
  const parsed = JSON.parse(stdout);
  if (parsed?.anchorIdea || parsed?.pads) return parsed;
  if (typeof parsed?.result === 'string') return JSON.parse(parsed.result);
  if (parsed?.result && typeof parsed.result === 'object') return parsed.result;
  if (parsed?.structured_output) return parsed.structured_output;
  throw new Error('Claude response did not include a remix plan');
}

async function claudePlan(track, analysis, { claudeBin = 'claude', model = 'sonnet' } = {}) {
  const compact = {
    track,
    bpm: analysis.bpm,
    duration: analysis.duration,
    vocalWindows: analysis.vocalWindows?.slice(0, 10),
    drumWindows: analysis.drumWindows?.slice(0, 8),
    bassWindows: analysis.bassWindows?.slice(0, 8),
    sections: analysis.sectionCandidates?.slice(0, 12),
    hooks: analysis.hookCandidates?.slice(0, 6),
    drops: analysis.dropCandidates?.slice(0, 6),
    roughKey: analysis.roughKey,
    warnings: analysis.warnings,
  };
  const prompt = [
    'You are the remix coach inside mixmash, a personal single-song stem instrument.',
    'The user wants to learn how to remix songs. Do not generate audio, lyrics, or a mashup.',
    'Use only the supplied local analysis evidence. Pick playable pads and production guidance.',
    'Return JSON only with keys: source, anchorIdea, moments, pads, arrangement, productionNotes.',
    'Make exactly 8 pads. Each pad needs id, name, description, start, duration, stemMix, loop, kind.',
    'stemMix must include vocals, drums, bass, other booleans.',
    '',
    JSON.stringify(compact, null, 2),
  ].join('\n');

  const { stdout } = await runWithInput(claudeBin, [
    '-p',
    '--output-format',
    'json',
    '--model',
    model,
    '--max-turns',
    '1',
    '--no-session-persistence',
    '--disable-slash-commands',
  ], prompt, {
    timeoutMs: CLAUDE_PLAN_TIMEOUT_MS,
    cwd: process.cwd(),
    env: {
      ...process.env,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    },
  });

  return parseClaudePlan(stdout);
}

export async function prepareRemixTrack(filename, {
  force = false,
  claudeBin = 'claude',
  model = 'sonnet',
} = {}) {
  const sourcePath = path.join(LIBRARY_ROOT, filename);
  if (!await pathExists(sourcePath)) throw new Error(`Track file not found: ${filename}`);

  const track = parseFilename(filename);
  const stemStatus = await ensureStems(filename, { force });
  const sourceMtime = await statMtime(sourcePath);
  const stems = await stemMtimes(filename);
  const cache = await readRemixCache();
  const cached = cache.tracks[filename];

  if (!force && cacheValid(cached, sourceMtime, stems)) {
    return {
      track: { ...track, duration: cached.analysis.duration, hasStems: true },
      status: 'ready',
      stemStatus,
      analysis: cached.analysis,
      plan: cached.plan,
      cache: { hit: true, path: REMIX_CACHE_PATH },
    };
  }

  const analysis = await analyzeTrack(track);
  let plan;
  try {
    plan = normalizePlan(track, analysis, await claudePlan(track, analysis, { claudeBin, model }));
  } catch (error) {
    plan = fallbackPlan(track, analysis);
    plan.warning = error instanceof Error ? error.message : String(error);
  }

  cache.tracks[filename] = {
    sourceMtimeMs: sourceMtime,
    stemMtimeMs: stems,
    analysis,
    plan,
    updatedAt: new Date().toISOString(),
  };
  await saveRemixCache(cache);

  return {
    track: { ...track, duration: analysis.duration, hasStems: true },
    status: 'ready',
    stemStatus,
    analysis,
    plan,
    cache: { hit: false, path: REMIX_CACHE_PATH },
  };
}
