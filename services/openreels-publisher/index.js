import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import chokidar from 'chokidar';

const HOVOD = process.env.HOVOD_BASE_URL || 'http://api:3000';
const OPENREELS_API_URL = (process.env.OPENREELS_API_URL || 'http://openreels-api:3000').replace(/\/$/, '');
const OUTPUT = process.env.OPENREELS_OUTPUT_DIR || '/output';
const POLL = Number(process.env.POLL_INTERVAL_MS || 15000);
const AUTO_PROCESS = process.env.AUTO_PROCESS !== 'false';
const API_KEY = process.env.HOVOD_API_KEY?.trim();
const PORT = Number(process.env.PORT || 3201);
const MAPPINGS_FILE = process.env.MAPPINGS_FILE || '/tmp/openreels-job-map.json';

const completed = new Set();
const inFlight = new Set();
const mappings = new Map();

function getHeaders(contentType) {
  const headers = {};
  if (contentType) headers['Content-Type'] = contentType;
  if (API_KEY) headers['X-Api-Key'] = API_KEY;
  return headers;
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function getJobIdFromPath(filePath) {
  const parent = path.basename(path.dirname(filePath));
  return parent || null;
}

function readJobTopic(job) {
  if (!job || typeof job !== 'object') return null;
  if (typeof job.topic === 'string' && job.topic) return job.topic;
  const input = job.input;
  if (input && typeof input === 'object' && typeof input.topic === 'string' && input.topic) return input.topic;
  return null;
}

function readJobOutputPath(job) {
  if (!job || typeof job !== 'object') return null;
  if (typeof job.outputPath === 'string' && job.outputPath) return job.outputPath;

  const output = job.output;
  if (output && typeof output === 'object') {
    if (typeof output.path === 'string' && output.path) return output.path;
    if (typeof output.finalPath === 'string' && output.finalPath) return output.finalPath;
    if (typeof output.directory === 'string' && output.directory) return path.join(output.directory, 'final.mp4');
  }

  if (typeof job.outputDir === 'string' && job.outputDir) {
    return path.join(job.outputDir, 'final.mp4');
  }

  return null;
}

async function loadMappings() {
  try {
    const raw = await fs.readFile(MAPPINGS_FILE, 'utf8');
    const entries = JSON.parse(raw);
    if (entries && typeof entries === 'object') {
      Object.entries(entries).forEach(([jobId, value]) => {
        mappings.set(jobId, value);
      });
    }
  } catch {
    // ignore when file doesn't exist
  }
}

async function persistMappings() {
  const payload = Object.fromEntries(mappings.entries());
  await fs.writeFile(MAPPINGS_FILE, JSON.stringify(payload, null, 2), 'utf8');
}

async function upsertMapping(jobId, patch) {
  if (!jobId) return;
  const current = mappings.get(jobId) || { jobId };
  mappings.set(jobId, {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
  await persistMappings();
}

async function hovodJson(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`${init.method || 'GET'} ${url} failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json?.data ?? json;
}

async function openreelsJson(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? json;
}

async function createAsset(title, filePath, jobId, topic) {
  const tags = 'openreels,learning';
  return hovodJson(`${HOVOD}/v1/assets`, {
    method: 'POST',
    headers: getHeaders('application/json'),
    body: JSON.stringify({
      title,
      metadata: {
        source: 'openreels',
        tags,
        openreelsFile: filePath,
        ...(jobId ? { openreelsJobId: jobId } : {}),
        ...(topic ? { topic } : {}),
      },
    }),
  });
}

async function getUploadUrl(assetId) {
  return hovodJson(`${HOVOD}/v1/assets/${assetId}/upload-url`, {
    method: 'POST',
    headers: getHeaders(),
  });
}

async function confirmUpload(assetId) {
  return hovodJson(`${HOVOD}/v1/assets/${assetId}/upload-complete`, {
    method: 'POST',
    headers: getHeaders(),
  });
}

async function processAsset(assetId) {
  return hovodJson(`${HOVOD}/v1/assets/${assetId}/process`, {
    method: 'POST',
    headers: getHeaders('application/json'),
    body: '{}',
  });
}

async function publishMp4(filePath, options = {}) {
  const basename = path.basename(filePath, '.mp4');
  const title = basename.replace(/[-_]/g, ' ').slice(0, 120);
  const jobId = options.jobId || getJobIdFromPath(filePath);
  const topic = options.topic || null;

  if (jobId) {
    await upsertMapping(jobId, {
      status: 'publishing',
      topic,
      filePath,
    });
  }

  console.log(`[publisher] Creating asset for ${title}`);
  const asset = await createAsset(title, filePath, jobId, topic);

  console.log(`[publisher] Requesting upload URL for ${asset.id}`);
  const { uploadUrl } = await getUploadUrl(asset.id);

  console.log(`[publisher] Uploading ${filePath} -> Hovod`);
  const buffer = await fs.readFile(filePath);
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    body: buffer,
    headers: { 'Content-Type': 'video/mp4' },
  });
  if (!put.ok) {
    throw new Error(`PUT ${uploadUrl} failed: ${put.status}`);
  }

  await confirmUpload(asset.id);

  if (AUTO_PROCESS) {
    console.log(`[publisher] Starting transcode for ${asset.id}`);
    await processAsset(asset.id);
  }

  if (jobId) {
    await upsertMapping(jobId, {
      status: AUTO_PROCESS ? 'processing' : 'uploaded',
      hovodAssetId: asset.id,
      playbackId: asset.playbackId,
      topic,
      filePath,
    });
  }

  console.log(`[publisher] Done -> asset ${asset.id}`);
  return asset.id;
}

async function queuePublish(filePath, options = {}) {
  if (!filePath.endsWith('final.mp4')) return;
  if (completed.has(filePath) || inFlight.has(filePath)) return;

  try {
    await fs.access(filePath);
  } catch {
    return;
  }

  const jobId = options.jobId || getJobIdFromPath(filePath);
  if (jobId) {
    const existing = mappings.get(jobId);
    if (existing?.hovodAssetId) {
      completed.add(filePath);
      return;
    }
  }

  inFlight.add(filePath);
  try {
    await publishMp4(filePath, options);
    completed.add(filePath);
  } catch (err) {
    if (jobId) {
      await upsertMapping(jobId, {
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
    console.error(`[publisher] Failed for ${filePath}:`, err);
  } finally {
    inFlight.delete(filePath);
  }
}

async function scanOnce() {
  let entries;
  try {
    entries = await fs.readdir(OUTPUT, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const mp4 = path.join(OUTPUT, entry.name, 'final.mp4');
    try {
      await fs.access(mp4);
      await queuePublish(mp4, { jobId: entry.name });
    } catch {
      // no final.mp4 yet
    }
  }
}

async function pollOpenReelsCompletedJobs() {
  const payload = await openreelsJson(`${OPENREELS_API_URL}/api/v1/jobs`);
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.jobs)
      ? payload.jobs
      : [];

  for (const job of list) {
    const id = typeof job?.id === 'string' ? job.id : null;
    if (!id) continue;

    const status = typeof job?.status === 'string' ? job.status.toLowerCase() : '';
    const topic = readJobTopic(job);

    if (status === 'completed') {
      const outputPath = readJobOutputPath(job) || path.join(OUTPUT, id, 'final.mp4');
      await queuePublish(outputPath, { jobId: id, topic });
    }
  }
}

async function pollOpenReelsCompletedJobsSafe() {
  try {
    await pollOpenReelsCompletedJobs();
  } catch (err) {
    console.warn('[publisher] OpenReels poll failed:', err instanceof Error ? err.message : String(err));
  }
}

function writeJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

function startStatusServer() {
  const server = createServer(async (req, res) => {
    if (!req.url) {
      writeJson(res, 400, { error: 'Missing URL' });
      return;
    }

    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/health') {
      writeJson(res, 200, { data: { ok: true } });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/mappings') {
      writeJson(res, 200, { data: Object.fromEntries(mappings.entries()) });
      return;
    }

    const match = url.pathname.match(/^\/mappings\/([^/]+)$/);
    if (req.method === 'GET' && match) {
      const jobId = decodeURIComponent(match[1]);
      const mapping = mappings.get(jobId);
      if (!mapping) {
        writeJson(res, 404, { error: 'Mapping not found' });
        return;
      }
      writeJson(res, 200, { data: mapping });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/mappings') {
      const body = await parseJsonBody(req);
      const jobId = typeof body?.jobId === 'string' ? body.jobId : null;
      if (!jobId) {
        writeJson(res, 400, { error: 'jobId is required' });
        return;
      }
      await upsertMapping(jobId, body);
      writeJson(res, 200, { data: mappings.get(jobId) });
      return;
    }

    writeJson(res, 404, { error: 'Not found' });
  });

  server.listen(PORT, () => {
    console.log(`[publisher] Mapping server listening on :${PORT}`);
  });
}

await loadMappings();

chokidar.watch(OUTPUT, { ignored: /(^|[/\\])\../, depth: 3 })
  .on('add', (p) => {
    void queuePublish(p);
  });

setInterval(() => {
  void scanOnce();
  void pollOpenReelsCompletedJobsSafe();
}, POLL);

startStatusServer();
void scanOnce();
void pollOpenReelsCompletedJobsSafe();
console.log(`[publisher] Watching ${OUTPUT} -> ${HOVOD}`);
