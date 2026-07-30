import { Queue } from 'bullmq';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { proposals, PROPOSAL_STATUS } from '@hovod/db';
import { db } from '../db.js';
import { env } from '../env.js';

type JsonRecord = Record<string, unknown>;

const listQuerySchema = z.object({
  status: z.enum([
    PROPOSAL_STATUS.PENDING,
    PROPOSAL_STATUS.APPROVED,
    PROPOSAL_STATUS.REJECTED,
    PROPOSAL_STATUS.GENERATED,
    PROPOSAL_STATUS.FAILED,
  ]).optional(),
  category: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const decisionBodySchema = z.object({
  reviewedBy: z.string().trim().min(1).max(255).optional(),
});

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (!value) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
};

const readArray = (value: unknown): string[] => {
  const arr = parseJson<unknown[]>(value, []);
  return arr.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
};

const readSourceType = (source: JsonRecord): string => {
  const raw = source.type;
  return typeof raw === 'string' ? raw : 'article';
};

const formatProposal = (row: typeof proposals.$inferSelect) => {
  const source = parseJson<JsonRecord>(row.source, {});
  const qualityScore = Math.max(0, Math.min(1, row.qualityScore / 1000));

  return {
    id: row.id,
    status: row.status,
    source,
    summary: row.summary,
    keyMessages: readArray(row.keyMessages),
    targetAudience: row.targetAudience,
    difficulty: row.difficulty,
    proposedTitle: row.proposedTitle,
    scriptOutline: row.scriptOutline,
    fullScriptDraft: row.fullScriptDraft,
    visualDirection: parseJson<JsonRecord>(row.visualDirection, {}),
    categories: readArray(row.categories),
    tags: readArray(row.tags),
    topics: readArray(row.topics),
    qualityScore,
    qualityRationale: row.qualityRationale,
    sourceQualitySignals: readArray(row.sourceQualitySignals),
    openreelsJobId: row.openreelsJobId,
    hovodAssetId: row.hovodAssetId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reviewedAt: row.reviewedAt,
    reviewedBy: row.reviewedBy,
  };
};

const readPublisherAssetId = async (jobId: string): Promise<string | null> => {
  const response = await fetch(`${env.OPENREELS_PUBLISHER_URL.replace(/\/$/, '')}/mappings/${encodeURIComponent(jobId)}`);
  if (!response.ok) return null;
  const payload = await response.json().catch(() => ({})) as { data?: { hovodAssetId?: string } };
  const assetId = payload?.data?.hovodAssetId;
  return typeof assetId === 'string' && assetId ? assetId : null;
};

const readOpenReelsJobId = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as JsonRecord;
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as JsonRecord;
  const id = data.id;
  return typeof id === 'string' && id ? id : null;
};

let discoverQueue: Queue | null = null;
const getDiscoverQueue = () => {
  if (!discoverQueue) {
    discoverQueue = new Queue('discover', { connection: { url: env.PROPOSAL_REDIS_URL } });
  }
  return discoverQueue;
};

const syncGeneratedStatus = async (row: typeof proposals.$inferSelect): Promise<typeof proposals.$inferSelect> => {
  if (row.status === PROPOSAL_STATUS.GENERATED || !row.openreelsJobId || row.hovodAssetId) return row;
  try {
    const assetId = await readPublisherAssetId(row.openreelsJobId);
    if (!assetId) return row;
    await db.update(proposals).set({
      hovodAssetId: assetId,
      status: PROPOSAL_STATUS.GENERATED,
    }).where(eq(proposals.id, row.id));
    const [updated] = await db.select().from(proposals).where(eq(proposals.id, row.id)).limit(1);
    return updated || row;
  } catch {
    return row;
  }
};

export async function proposalRoutes(app: FastifyInstance) {
  app.get('/v1/proposals', async (request) => {
    const query = listQuerySchema.parse(request.query || {});

    const whereStatus = query.status ? eq(proposals.status, query.status) : undefined;
    const rows = whereStatus
      ? await db.select().from(proposals).where(whereStatus).orderBy(desc(proposals.createdAt)).limit(query.limit)
      : await db.select().from(proposals).orderBy(desc(proposals.createdAt)).limit(query.limit);

    const filtered = query.category
      ? rows.filter((row) => {
          const categories = readArray(row.categories);
          return categories.some((category) => category.toLowerCase() === query.category!.toLowerCase());
        })
      : rows;

    return { data: filtered.map(formatProposal) };
  });

  app.get<{ Params: { id: string } }>('/v1/proposals/:id', async (request, reply) => {
    const [row] = await db.select().from(proposals).where(eq(proposals.id, request.params.id)).limit(1);
    if (!row) return reply.code(404).send({ error: 'Proposal not found' });
    const synced = await syncGeneratedStatus(row);
    return { data: formatProposal(synced) };
  });

  app.post<{ Params: { id: string }; Body: z.infer<typeof decisionBodySchema> }>(
    '/v1/proposals/:id/approve',
    async (request, reply) => {
      const body = decisionBodySchema.parse(request.body || {});
      const [row] = await db.select().from(proposals).where(eq(proposals.id, request.params.id)).limit(1);
      if (!row) return reply.code(404).send({ error: 'Proposal not found' });

      if (row.status === PROPOSAL_STATUS.GENERATED) {
        return { data: formatProposal(row) };
      }

      const direction = row.fullScriptDraft || row.scriptOutline;
      const source = parseJson<JsonRecord>(row.source, {});
      const visualDirection = parseJson<JsonRecord>(row.visualDirection, {});

      const openReelsResponse = await fetch(`${env.OPENREELS_API_URL.replace(/\/$/, '')}/api/v1/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: row.proposedTitle,
          direction,
          ...(typeof visualDirection.archetype === 'string' && visualDirection.archetype
            ? { archetype: visualDirection.archetype }
            : {}),
          provider: env.OPENREELS_DEFAULT_PROVIDER,
          metadata: {
            sourceUrl: source.url,
            proposalId: row.id,
          },
        }),
      });

      const payload = await openReelsResponse.json().catch(() => ({}));
      if (!openReelsResponse.ok) {
        return reply.code(502).send({ error: (payload as { error?: string }).error || 'Failed to start OpenReels job' });
      }

      const openreelsJobId = readOpenReelsJobId(payload);
      if (!openreelsJobId) {
        return reply.code(502).send({ error: 'OpenReels response missing job id' });
      }

      await db.update(proposals).set({
        status: PROPOSAL_STATUS.APPROVED,
        openreelsJobId,
        reviewedAt: new Date(),
        reviewedBy: body.reviewedBy || request.userId || 'api-key',
      }).where(eq(proposals.id, row.id));

      const [updated] = await db.select().from(proposals).where(eq(proposals.id, row.id)).limit(1);
      return { data: formatProposal(updated || row) };
    },
  );

  app.post<{ Params: { id: string }; Body: z.infer<typeof decisionBodySchema> }>(
    '/v1/proposals/:id/reject',
    async (request, reply) => {
      const body = decisionBodySchema.parse(request.body || {});
      const [row] = await db.select().from(proposals).where(eq(proposals.id, request.params.id)).limit(1);
      if (!row) return reply.code(404).send({ error: 'Proposal not found' });

      await db.update(proposals).set({
        status: PROPOSAL_STATUS.REJECTED,
        reviewedAt: new Date(),
        reviewedBy: body.reviewedBy || request.userId || 'api-key',
      }).where(eq(proposals.id, row.id));

      const [updated] = await db.select().from(proposals).where(eq(proposals.id, row.id)).limit(1);
      return { data: formatProposal(updated || row) };
    },
  );

  app.post('/v1/proposals/discover', async (request: FastifyRequest, reply) => {
    const queue = getDiscoverQueue();
    const proposalRows = await db.select({ createdAt: proposals.createdAt }).from(proposals);
    const rateCap = env.MAX_PROPOSALS_PER_DAY;
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const current = proposalRows.filter((row) => row.createdAt >= dayStart).length;
    if (rateCap > 0 && current >= rateCap) {
      return reply.code(429).send({ error: 'Daily proposal limit reached' });
    }

    const job = await queue.add('manual-discovery', {
      trigger: 'manual',
      orgId: request.orgId || null,
      requestedAt: new Date().toISOString(),
    }, { removeOnComplete: 50, removeOnFail: 50 });

    return { data: { queued: true, jobId: String(job.id) } };
  });

  app.get('/v1/proposals/stats', async () => {
    const rows = await db.select({
      status: proposals.status,
      source: proposals.source,
    }).from(proposals);

    const byStatus: Record<string, number> = {};
    const bySourceType: Record<string, number> = {};

    for (const row of rows) {
      byStatus[row.status] = (byStatus[row.status] || 0) + 1;
      const source = parseJson<JsonRecord>(row.source, {});
      const sourceType = readSourceType(source);
      bySourceType[sourceType] = (bySourceType[sourceType] || 0) + 1;
    }

    return {
      data: {
        total: rows.length,
        byStatus,
        bySourceType,
      },
    };
  });
}
