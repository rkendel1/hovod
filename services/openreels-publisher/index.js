import fs from 'node:fs/promises';
import path from 'node:path';
import chokidar from 'chokidar';

const HOVOD = process.env.HOVOD_BASE_URL || 'http://api:3000';
const OUTPUT = process.env.OPENREELS_OUTPUT_DIR || '/output';
const POLL = Number(process.env.POLL_INTERVAL_MS || 15000);
const AUTO_PROCESS = process.env.AUTO_PROCESS !== 'false';
const API_KEY = process.env.HOVOD_API_KEY?.trim();

const completed = new Set();
const inFlight = new Set();

function getHeaders(contentType) {
  const headers = {};
  if (contentType) headers['Content-Type'] = contentType;
  if (API_KEY) headers['X-Api-Key'] = API_KEY;
  return headers;
}

async function hovodJson(url, init = {}) {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`${init.method || 'GET'} ${url} failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json?.data ?? json;
}

async function createAsset(title, filePath) {
  return hovodJson(`${HOVOD}/v1/assets`, {
    method: 'POST',
    headers: getHeaders('application/json'),
    body: JSON.stringify({
      title,
      metadata: {
        source: 'openreels',
        tags: 'openreels,ai-generated,short',
        openreelsFile: filePath,
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

async function publishMp4(filePath) {
  const basename = path.basename(filePath, '.mp4');
  const title = basename.replace(/[-_]/g, ' ').slice(0, 120);

  console.log(`[publisher] Creating asset for ${title}`);
  const asset = await createAsset(title, filePath);

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

  console.log(`[publisher] Done -> asset ${asset.id}`);
}

async function queuePublish(filePath) {
  if (!filePath.endsWith('final.mp4')) return;
  if (completed.has(filePath) || inFlight.has(filePath)) return;
  inFlight.add(filePath);
  try {
    await publishMp4(filePath);
    completed.add(filePath);
  } catch (err) {
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
      await queuePublish(mp4);
    } catch {
      // no final.mp4 yet
    }
  }
}

chokidar.watch(OUTPUT, { ignored: /(^|[/\\])\../, depth: 3 })
  .on('add', (p) => {
    void queuePublish(p);
  });

setInterval(() => {
  void scanOnce();
}, POLL);

void scanOnce();
console.log(`[publisher] Watching ${OUTPUT} -> ${HOVOD}`);
