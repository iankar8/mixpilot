import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const CACHE_DIR = path.join(os.homedir(), '.mixmash');
export const ANALYSIS_V2_PATH = path.join(CACHE_DIR, 'analysis-v2.json');
export const LIBRARY_ROOT = path.join(os.homedir(), 'Music', 'dj-library');
const WORKER_PATH = path.join(__dirname, '..', 'workers', 'analyze_track_v2.py');

export const analysisV2Job = {
  running: false,
  total: 0,
  completed: 0,
  cacheCount: 0,
  lastTrack: null,
  error: null,
  startedAt: null,
  updatedAt: null,
  dependencyStatus: null,
};

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readAnalysisV2Cache() {
  try {
    const raw = await fs.readFile(ANALYSIS_V2_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.version === 2 && parsed.tracks) return parsed;
  } catch {
    // The cache is an optimization; missing or invalid files are rebuilt.
  }
  return { version: 2, updatedAt: null, tracks: {} };
}

export async function saveAnalysisV2Cache(cache) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  cache.updatedAt = new Date().toISOString();
  await fs.writeFile(ANALYSIS_V2_PATH, JSON.stringify(cache, null, 2));
}

export async function dependencyStatus() {
  const checks = await Promise.all([
    execFileAsync('python3', ['--version'], { timeout: 5_000 }).then(
      ({ stdout, stderr }) => ({ name: 'python3', ok: true, version: `${stdout}${stderr}`.trim() }),
      (error) => ({ name: 'python3', ok: false, error: error.message }),
    ),
    execFileAsync('ffmpeg', ['-version'], { timeout: 5_000 }).then(
      ({ stdout }) => ({ name: 'ffmpeg', ok: true, version: stdout.split('\n')[0] }),
      (error) => ({ name: 'ffmpeg', ok: false, error: error.message }),
    ),
    execFileAsync('python3', ['-c', 'import numpy; print(numpy.__version__)'], { timeout: 5_000 }).then(
      ({ stdout }) => ({ name: 'numpy', ok: true, version: stdout.trim() }),
      (error) => ({ name: 'numpy', ok: false, error: error.message }),
    ),
  ]);

  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

async function sourceMtime(track) {
  const filePath = path.join(LIBRARY_ROOT, track.filename);
  const stat = await fs.stat(filePath).catch(() => null);
  return stat ? Number((stat.mtimeMs).toFixed(3)) : 0;
}

async function analyzeTrackV2(track) {
  const payload = JSON.stringify({ track, libraryRoot: LIBRARY_ROOT });
  const encodedPayload = Buffer.from(payload, 'utf8').toString('base64');
  const { stdout } = await execFileAsync('python3', [WORKER_PATH, encodedPayload], {
    timeout: 70_000,
    maxBuffer: 6 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

export async function runAnalysisV2(tracks, { force = false, onComplete } = {}) {
  if (analysisV2Job.running) return;

  analysisV2Job.running = true;
  analysisV2Job.total = tracks.length;
  analysisV2Job.completed = 0;
  analysisV2Job.cacheCount = 0;
  analysisV2Job.lastTrack = null;
  analysisV2Job.error = null;
  analysisV2Job.startedAt = new Date().toISOString();
  analysisV2Job.updatedAt = analysisV2Job.startedAt;
  analysisV2Job.dependencyStatus = await dependencyStatus();

  try {
    if (!analysisV2Job.dependencyStatus.ok) {
      throw new Error('Analysis v2 dependencies are not ready');
    }

    const cache = await readAnalysisV2Cache();

    for (const track of tracks) {
      analysisV2Job.lastTrack = `${track.artist} - ${track.name}`;
      const cached = cache.tracks[track.id];
      const mtime = await sourceMtime(track);

      if (!force && cached && cached.fileMtimeMs === mtime) {
        analysisV2Job.completed += 1;
        continue;
      }

      if (!(await pathExists(path.join(LIBRARY_ROOT, track.filename)))) {
        analysisV2Job.completed += 1;
        continue;
      }

      cache.tracks[track.id] = await analyzeTrackV2(track);
      analysisV2Job.completed += 1;
      analysisV2Job.cacheCount = Object.keys(cache.tracks).length;
      analysisV2Job.updatedAt = new Date().toISOString();

      if (analysisV2Job.completed % 5 === 0) {
        await saveAnalysisV2Cache(cache);
      }
    }

    analysisV2Job.cacheCount = Object.keys(cache.tracks).length;
    await saveAnalysisV2Cache(cache);
    if (onComplete) await onComplete(cache);
  } catch (error) {
    analysisV2Job.error = error instanceof Error ? error.message : String(error);
  } finally {
    analysisV2Job.running = false;
    analysisV2Job.updatedAt = new Date().toISOString();
  }
}
