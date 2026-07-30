import { Queue, Worker } from 'bullmq';
import mysql from 'mysql2/promise';

const REDIS_URL = process.env.REDIS_URL || 'redis://proposal-redis:6379';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const db = await mysql.createConnection(DATABASE_URL);
const proposeQueue = new Queue('propose', { connection: { url: REDIS_URL } });

const normalizeLanguage = (rawMeta) => {
  if (rawMeta && typeof rawMeta.language === 'string' && rawMeta.language) return rawMeta.language;
  return 'en';
};

const buildAnalysis = (candidate) => {
  const rawMeta = candidate.raw_meta ? JSON.parse(candidate.raw_meta) : {};
  const sourceType = candidate.source_type;
  const authority = rawMeta.authority || (rawMeta.configured ? 'curated' : 'community');
  const durationMinutes = Number(rawMeta.durationMinutes || 30);
  const language = normalizeLanguage(rawMeta);

  const summary = `This ${sourceType} source highlights practical ideas from "${candidate.title}" and frames them for quick learning consumption. It is curated for concise explainers and can be transformed into a short, high-signal educational video.`;
  const keyMessages = [
    'Start with a clear mental model before tactics.',
    'Use concrete examples to explain abstract ideas.',
    'End with one actionable next step.',
  ];
  const categories = sourceType === 'podcast' ? ['communication', 'mindset'] : ['learning', 'productivity'];
  const topics = sourceType === 'podcast' ? ['conversation', 'decision-making'] : ['lectures', 'self-improvement'];

  const authorityBoost = authority === 'university' || authority === 'top-chart' ? 0.2 : 0.1;
  const durationBoost = durationMinutes >= 20 ? 0.15 : 0.05;
  const qualityScore = Math.max(0, Math.min(1, 0.55 + authorityBoost + durationBoost));

  return {
    summary,
    keyMessages,
    targetAudience: 'Lifelong learners and professionals',
    difficulty: qualityScore > 0.8 ? 'intermediate' : 'intro',
    categories,
    tags: [sourceType, authority, 'from-proposals'],
    topics,
    qualityScore,
    qualityRationale: `Authority signal "${authority}" with ${durationMinutes} minute runtime and ${language} language support.`,
    sourceQualitySignals: [
      `authority:${authority}`,
      `duration:${durationMinutes}`,
      `language:${language}`,
    ],
  };
};

const worker = new Worker(
  'analyze',
  async (job) => {
    const candidateId = String(job.data?.candidateId || '');
    if (!candidateId) return;

    const [rows] = await db.execute('SELECT * FROM proposal_candidates WHERE id = ? LIMIT 1', [candidateId]);
    const candidate = Array.isArray(rows) ? rows[0] : null;
    if (!candidate) return;

    const analysis = buildAnalysis(candidate);
    await db.execute(
      `UPDATE proposal_candidates
       SET analysis = ?, status = 'analyzed', updated_at = NOW(), error_message = NULL
       WHERE id = ?`,
      [JSON.stringify(analysis), candidateId],
    );

    await proposeQueue.add(
      'generate-proposal',
      { candidateId },
      { removeOnComplete: 100, removeOnFail: 100 },
    );
  },
  { connection: { url: REDIS_URL } },
);

worker.on('ready', () => console.log('[source-analyzer] ready'));
worker.on('failed', async (job, err) => {
  const candidateId = String(job?.data?.candidateId || '');
  if (!candidateId) return;
  await db.execute(
    `UPDATE proposal_candidates SET status = 'failed', error_message = ?, updated_at = NOW() WHERE id = ?`,
    [err.message.slice(0, 1024), candidateId],
  ).catch(() => {});
  console.error('[source-analyzer] failed', err.message);
});
