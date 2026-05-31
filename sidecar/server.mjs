import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.MIXMASH_SIDECAR_PORT || 8787);
const CLAUDE_BIN = process.env.MIXMASH_CLAUDE_BIN || 'claude';
const CLAUDE_MODEL = process.env.MIXMASH_CLAUDE_MODEL || 'sonnet';
const REQUEST_LIMIT_BYTES = 512_000;
const CACHE_DIR = path.join(os.homedir(), '.mixmash');
const CACHE_PATH = path.join(CACHE_DIR, 'track-analysis-cache.json');
const LIBRARY_ROOT = path.join(os.homedir(), 'Music', 'dj-library');

const analysisJob = {
  running: false,
  total: 0,
  completed: 0,
  cacheCount: 0,
  lastTrack: null,
  error: null,
  startedAt: null,
  updatedAt: null,
};

const sceneSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['scenes'],
  properties: {
    scenes: {
      type: 'array',
      minItems: 4,
      maxItems: 4,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'name',
          'description',
          'keyHint',
          'deckAStems',
          'deckBStems',
          'crossfader',
          'transition',
        ],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          keyHint: { type: 'string', enum: ['1', '2', '3', '4'] },
          deckAStems: { $ref: '#/$defs/stemState' },
          deckBStems: { $ref: '#/$defs/stemState' },
          crossfader: { type: 'number', minimum: 0, maximum: 1 },
          transition: { type: 'string', enum: ['cut', 'fade'] },
        },
      },
    },
  },
  $defs: {
    stemState: {
      type: 'object',
      additionalProperties: false,
      required: ['vocals', 'drums', 'bass', 'other'],
      properties: {
        vocals: { type: 'boolean' },
        drums: { type: 'boolean' },
        bass: { type: 'boolean' },
        other: { type: 'boolean' },
      },
    },
  },
};

function setCors(req, res) {
  const origin = req.headers.origin;
  if (
    origin === 'http://127.0.0.1:5173' ||
    origin === 'http://localhost:5173' ||
    origin === undefined
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin || 'http://127.0.0.1:5173');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(req, res, status, body) {
  setCors(req, res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > REQUEST_LIMIT_BYTES) {
      throw new Error('Request body too large');
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function buildScenePrompt(payload) {
  return [
    'You are the local AI music assistant inside mixmash, a personal stem mashup instrument.',
    'The human wants tactile control. Do not write a tutorial. Produce immediately playable scene suggestions.',
    'Use the supplied BPM, sync confidence, phrase/beat hints, stem names, and track metadata.',
    'Each scene should be musically different and should preserve human control: no autoplay plan, no long arrangement.',
    'Prefer useful DJ mechanisms: A beat under B vocal, B beat under A vocal, chorus lift, breakdown/swap, tension/release.',
    'Return JSON only, matching the provided schema exactly.',
    '',
    'Payload:',
    JSON.stringify(payload, null, 2),
  ].join('\n');
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadAnalysisCache() {
  try {
    const raw = await fs.readFile(CACHE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.version === 1 && parsed.tracks) return parsed;
  } catch {
    // Missing or invalid cache is fine; it will be rebuilt.
  }
  return { version: 1, updatedAt: null, tracks: {} };
}

async function saveAnalysisCache(cache) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  cache.updatedAt = new Date().toISOString();
  await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function probeDuration(filePath) {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ],
      { timeout: 8_000, maxBuffer: 64 * 1024 },
    );
    const duration = Number.parseFloat(stdout.trim());
    return Number.isFinite(duration) ? duration : 0;
  } catch {
    return 0;
  }
}

function createMarkers(duration, bpm, everyBeats) {
  if (!duration || !bpm) return [];
  const markers = [];
  const step = (60 / bpm) * everyBeats;
  for (let time = 0; time <= duration; time += step) {
    markers.push(Number(time.toFixed(3)));
  }
  return markers;
}

function trackStemDir(filename) {
  return path.join(LIBRARY_ROOT, 'stems', filename.replace(/\.mp3$/i, ''));
}

async function analyzeKnownTrack(track) {
  const filePath = path.join(LIBRARY_ROOT, track.filename);
  const stemDir = trackStemDir(track.filename);
  const fileStat = await fs.stat(filePath).catch(() => null);
  const duration = fileStat ? await probeDuration(filePath) : 0;
  const bpm = Number(track.bpm || 128);
  const stemAvailability = {
    vocals: await pathExists(path.join(stemDir, 'vocals.mp3')),
    drums: await pathExists(path.join(stemDir, 'drums.mp3')),
    bass: await pathExists(path.join(stemDir, 'bass.mp3')),
    other: await pathExists(path.join(stemDir, 'other.mp3')),
  };
  const stemCount = Object.values(stemAvailability).filter(Boolean).length;

  return {
    trackId: track.id,
    name: track.name,
    artist: track.artist,
    filename: track.filename,
    bpm,
    duration,
    beatPeriod: bpm > 0 ? 60 / bpm : 0,
    downbeats: createMarkers(duration, bpm, 4),
    phrases: createMarkers(duration, bpm, 16),
    stemAvailability,
    confidence: Math.min(0.95, 0.56 + (duration ? 0.16 : 0) + stemCount * 0.055),
    source: 'sidecar-background',
    fileMtimeMs: fileStat?.mtimeMs ?? 0,
    analyzedAt: Date.now(),
  };
}

async function runLibraryAnalysis(tracks) {
  if (analysisJob.running) return;

  analysisJob.running = true;
  analysisJob.total = tracks.length;
  analysisJob.completed = 0;
  analysisJob.error = null;
  analysisJob.startedAt = new Date().toISOString();
  analysisJob.updatedAt = analysisJob.startedAt;

  try {
    const cache = await loadAnalysisCache();

    for (const track of tracks) {
      analysisJob.lastTrack = `${track.artist} - ${track.name}`;
      const cached = cache.tracks[track.id];
      const filePath = path.join(LIBRARY_ROOT, track.filename);
      const fileStat = await fs.stat(filePath).catch(() => null);

      if (cached && fileStat && cached.fileMtimeMs === fileStat.mtimeMs) {
        analysisJob.completed += 1;
        continue;
      }

      cache.tracks[track.id] = await analyzeKnownTrack(track);
      analysisJob.completed += 1;
      analysisJob.cacheCount = Object.keys(cache.tracks).length;
      analysisJob.updatedAt = new Date().toISOString();

      if (analysisJob.completed % 8 === 0) {
        await saveAnalysisCache(cache);
      }
    }

    analysisJob.cacheCount = Object.keys(cache.tracks).length;
    await saveAnalysisCache(cache);
  } catch (error) {
    analysisJob.error = error instanceof Error ? error.message : String(error);
  } finally {
    analysisJob.running = false;
    analysisJob.updatedAt = new Date().toISOString();
  }
}

function parseClaudeJson(stdout) {
  const parsed = JSON.parse(stdout);
  if (parsed?.scenes) return parsed;
  if (parsed?.structured_output?.scenes) return parsed.structured_output;
  if (typeof parsed?.result === 'object' && parsed.result?.scenes) return parsed.result;
  if (typeof parsed?.result === 'string') return JSON.parse(parsed.result);
  throw new Error('Claude response did not include scenes');
}

function normalizeScenes(scenes) {
  return scenes.map((scene, index) => ({
    id: String(scene.id || `model-scene-${index + 1}`).toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    name: String(scene.name || `Scene ${index + 1}`).slice(0, 48),
    description: String(scene.description || '').slice(0, 180),
    keyHint: String(index + 1),
    deckAStems: {
      vocals: Boolean(scene.deckAStems?.vocals),
      drums: Boolean(scene.deckAStems?.drums),
      bass: Boolean(scene.deckAStems?.bass),
      other: Boolean(scene.deckAStems?.other),
    },
    deckBStems: {
      vocals: Boolean(scene.deckBStems?.vocals),
      drums: Boolean(scene.deckBStems?.drums),
      bass: Boolean(scene.deckBStems?.bass),
      other: Boolean(scene.deckBStems?.other),
    },
    crossfader: Math.max(0, Math.min(1, Number(scene.crossfader ?? 0.5))),
    transition: scene.transition === 'fade' ? 'fade' : 'cut',
  }));
}

async function suggestScenes(payload) {
  const prompt = buildScenePrompt(payload);
  const args = [
    '-p',
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(sceneSchema),
    '--model',
    CLAUDE_MODEL,
    '--no-session-persistence',
    '--disable-slash-commands',
    prompt,
  ];

  const { stdout } = await execFileAsync(CLAUDE_BIN, args, {
    cwd: process.cwd(),
    timeout: 90_000,
    maxBuffer: 2 * 1024 * 1024,
    env: {
      ...process.env,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    },
  });

  const parsed = parseClaudeJson(stdout);
  return normalizeScenes(parsed.scenes);
}

async function claudeStatus() {
  try {
    const { stdout } = await execFileAsync(CLAUDE_BIN, ['auth', 'status'], {
      timeout: 5_000,
      maxBuffer: 256 * 1024,
    });
    const status = JSON.parse(stdout);
    return {
      available: true,
      loggedIn: Boolean(status.loggedIn),
      authMethod: status.authMethod,
      subscriptionType: status.subscriptionType,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    sendJson(req, res, 400, { ok: false, error: 'Missing URL' });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || `127.0.0.1:${PORT}`}`);

  if (req.method === 'OPTIONS') {
    setCors(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      const cache = await loadAnalysisCache();
      sendJson(req, res, 200, {
        ok: true,
        service: 'mixmash-sidecar',
        modelProvider: 'claude-cli',
        cachePath: CACHE_PATH,
        analysis: {
          ...analysisJob,
          cacheCount: Object.keys(cache.tracks).length,
        },
        claude: await claudeStatus(),
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/analysis-status') {
      const cache = await loadAnalysisCache();
      sendJson(req, res, 200, {
        ok: true,
        ...analysisJob,
        cacheCount: Object.keys(cache.tracks).length,
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/analysis-cache') {
      sendJson(req, res, 200, {
        ok: true,
        cache: await loadAnalysisCache(),
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/analyze-library') {
      const payload = await readJson(req);
      const tracks = Array.isArray(payload.tracks) ? payload.tracks : [];
      if (!tracks.length) {
        sendJson(req, res, 400, { ok: false, error: 'Expected tracks array' });
        return;
      }

      if (!analysisJob.running) {
        void runLibraryAnalysis(tracks);
      }

      sendJson(req, res, 202, {
        ok: true,
        accepted: true,
        ...analysisJob,
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/suggest-scenes') {
      const payload = await readJson(req);
      const scenes = await suggestScenes(payload);
      sendJson(req, res, 200, {
        ok: true,
        source: 'claude-cli',
        scenes,
      });
      return;
    }

    sendJson(req, res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    sendJson(req, res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mixmash-sidecar] listening on http://127.0.0.1:${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
