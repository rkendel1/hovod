import { Worker } from 'bullmq';
import mysql from 'mysql2/promise';
import { nanoid } from 'nanoid';

const REDIS_URL = process.env.REDIS_URL || 'redis://proposal-redis:6379';
const DATABASE_URL = process.env.DATABASE_URL;
const MIN_QUALITY_SCORE = Number(process.env.MIN_QUALITY_SCORE || 0.65);
const AUTO_APPROVE_ABOVE = Number(process.env.AUTO_APPROVE_ABOVE || 0);

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const db = await mysql.createConnection(DATABASE_URL);

const toFixedQuality = (value) => Math.max(0, Math.min(1000, Math.round(value * 1000)));

const worker = new Worker(
  'propose',
  async (job) => {
    const candidateId = String(job.data?.candidateId || '');
    if (!candidateId) return;

    const [rows] = await db.execute('SELECT * FROM proposal_candidates WHERE id = ? LIMIT 1', [candidateId]);
    const candidate = Array.isArray(rows) ? rows[0] : null;
    if (!candidate) return;

    const analysis = candidate.analysis ? JSON.parse(candidate.analysis) : null;
    if (!analysis) return;

    const qualityScore = Number(analysis.qualityScore || 0);
    const shouldPersist = qualityScore >= MIN_QUALITY_SCORE;

    await db.execute(
      `UPDATE proposal_candidates
       SET status = ?, updated_at = NOW(), error_message = NULL
       WHERE id = ?`,
      [shouldPersist ? 'proposed' : 'filtered', candidateId],
    );

    if (!shouldPersist) return;

    const proposalId = nanoid(16);
    const source = {
      type: candidate.source_type,
      title: candidate.title,
      url: candidate.url,
      canonicalId: candidate.canonical_id || undefined,
      language: analysis.sourceQualitySignals?.find?.((value) => String(value).startsWith('language:'))?.split(':')?.[1] || 'en',
      durationMinutes: Number(candidate.raw_meta ? (JSON.parse(candidate.raw_meta).durationMinutes || 0) : 0) || undefined,
    };

    const visualDirection = {
      archetype: candidate.source_type === 'youtube' ? 'narrator' : 'podcast-host',
      imageryNotes: [
        'Open with source title card and citation',
        'Use animated bullet overlays for each key message',
        'Close with clear action takeaway and source attribution',
      ],
      mood: 'curious and practical',
      mustInclude: ['show source title', 'display source URL'],
    };

    const status = AUTO_APPROVE_ABOVE > 0 && qualityScore >= AUTO_APPROVE_ABOVE ? 'approved' : 'pending';
    const now = new Date();

    await db.execute(
      `INSERT INTO proposals
      (id, candidate_id, status, source, summary, key_messages, target_audience, difficulty, proposed_title, script_outline, full_script_draft, visual_direction, categories, tags, topics, quality_score, quality_rationale, source_quality_signals, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        proposalId,
        candidateId,
        status,
        JSON.stringify(source),
        String(analysis.summary || ''),
        JSON.stringify(Array.isArray(analysis.keyMessages) ? analysis.keyMessages : []),
        analysis.targetAudience || null,
        analysis.difficulty || 'intro',
        `What to learn from ${candidate.title}`.slice(0, 255),
        `Hook: Why "${candidate.title}" matters now.\n\nIdea 1: ${analysis.keyMessages?.[0] || 'Core principle'}\nIdea 2: ${analysis.keyMessages?.[1] || 'Practical example'}\nIdea 3: ${analysis.keyMessages?.[2] || 'Apply immediately'}\n\nTakeaway: One action to try today.`,
        null,
        JSON.stringify(visualDirection),
        JSON.stringify(Array.isArray(analysis.categories) ? analysis.categories : []),
        JSON.stringify(Array.isArray(analysis.tags) ? analysis.tags : []),
        JSON.stringify(Array.isArray(analysis.topics) ? analysis.topics : []),
        toFixedQuality(qualityScore),
        String(analysis.qualityRationale || ''),
        JSON.stringify(Array.isArray(analysis.sourceQualitySignals) ? analysis.sourceQualitySignals : []),
        now,
        now,
      ],
    );
  },
  { connection: { url: REDIS_URL } },
);

worker.on('ready', () => console.log('[proposal-generator] ready'));
worker.on('failed', async (job, err) => {
  const candidateId = String(job?.data?.candidateId || '');
  if (!candidateId) return;
  await db.execute(
    `UPDATE proposal_candidates SET status = 'failed', error_message = ?, updated_at = NOW() WHERE id = ?`,
    [err.message.slice(0, 1024), candidateId],
  ).catch(() => {});
  console.error('[proposal-generator] failed', err.message);
});
