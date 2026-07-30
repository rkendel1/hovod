import crypto from 'node:crypto';
import { Queue, Worker } from 'bullmq';
import mysql from 'mysql2/promise';
import { nanoid } from 'nanoid';

const REDIS_URL = process.env.REDIS_URL || 'redis://proposal-redis:6379';
const DATABASE_URL = process.env.DATABASE_URL;
const DISCOVERY_INTERVAL_HOURS = Number(process.env.DISCOVERY_INTERVAL_HOURS || 6);
const MAX_CANDIDATES_PER_RUN = Number(process.env.MAX_CANDIDATES_PER_RUN || 50);
const YOUTUBE_FEEDS = (process.env.YOUTUBE_FEEDS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const PODCAST_FEEDS = (process.env.PODCAST_FEEDS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const db = await mysql.createConnection(DATABASE_URL);
const analyzeQueue = new Queue('analyze', { connection: { url: REDIS_URL } });

const fallbackSources = [
  {
    sourceType: 'youtube',
    title: 'Stanford eCorner Lecture',
    url: 'https://www.youtube.com/watch?v=example-stanford',
    canonicalId: 'example-stanford',
    rawMeta: { authority: 'university', durationMinutes: 42, language: 'en' },
  },
  {
    sourceType: 'podcast',
    title: 'High Signal Podcast Episode',
    url: 'https://podcasts.apple.com/us/podcast/example/id000000?i=example',
    canonicalId: 'example-podcast-episode',
    rawMeta: { authority: 'top-chart', durationMinutes: 55, language: 'en' },
  },
];

const parseFeed = (value, sourceType) => {
  const [title, url] = value.split('|').map((item) => item?.trim());
  if (!url) return null;
  return {
    sourceType,
    title: title || `${sourceType} source`,
    url,
    canonicalId: null,
    rawMeta: { configured: true, language: 'en' },
  };
};

const configuredSources = [
  ...YOUTUBE_FEEDS.map((item) => parseFeed(item, 'youtube')).filter(Boolean),
  ...PODCAST_FEEDS.map((item) => parseFeed(item, 'podcast')).filter(Boolean),
];

const sourcePack = configuredSources.length > 0 ? configuredSources : fallbackSources;

const canonicalKeyFor = (candidate) => {
  const base = candidate.canonicalId || candidate.url.toLowerCase().replace(/\/+$/, '');
  return `${candidate.sourceType}:${base}`;
};

const insertCandidate = async (candidate) => {
  const canonicalKey = canonicalKeyFor(candidate);
  const id = nanoid(20);
  const now = new Date();
  try {
    await db.execute(
      `INSERT INTO proposal_candidates
      (id, source_type, canonical_key, canonical_id, url, title, raw_meta, status, created_at, updated_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'discovered', ?, ?, ?)`,
      [
        id,
        candidate.sourceType,
        canonicalKey,
        candidate.canonicalId,
        candidate.url,
        candidate.title,
        JSON.stringify(candidate.rawMeta || {}),
        now,
        now,
        now,
      ],
    );
    return id;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_DUP_ENTRY') {
      await db.execute(
        `UPDATE proposal_candidates
         SET last_seen_at = ?, updated_at = ?, title = ?, raw_meta = ?
         WHERE canonical_key = ?`,
        [now, now, candidate.title, JSON.stringify(candidate.rawMeta || {}), canonicalKey],
      );
      return null;
    }
    throw error;
  }
};

const worker = new Worker(
  'discover',
  async () => {
    const picked = sourcePack.slice(0, Math.max(1, MAX_CANDIDATES_PER_RUN));
    for (const candidate of picked) {
      const candidateId = await insertCandidate(candidate);
      if (!candidateId) continue;
      await analyzeQueue.add(
        'analyze-candidate',
        { candidateId, sourceType: candidate.sourceType, discoveryToken: crypto.randomUUID() },
        { removeOnComplete: 100, removeOnFail: 100 },
      );
    }
    return { discovered: picked.length };
  },
  { connection: { url: REDIS_URL } },
);

worker.on('ready', () => console.log('[source-discovery] ready'));
worker.on('failed', (_job, err) => console.error('[source-discovery] failed', err.message));

const discoverQueue = new Queue('discover', { connection: { url: REDIS_URL } });
await discoverQueue.add(
  'scheduled-discovery',
  { trigger: 'startup' },
  {
    repeat: { every: Math.max(1, DISCOVERY_INTERVAL_HOURS) * 60 * 60 * 1000 },
    removeOnComplete: 10,
    removeOnFail: 10,
  },
);

console.log('[source-discovery] scheduled');
