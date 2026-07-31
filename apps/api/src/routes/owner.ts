import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  ASSET_STATUS,
  PUBLISHED_STATUS,
  assetQuizzes,
  assets,
  comments,
  jobs,
  proposals,
  publishedAssets,
  userVideoEvents,
} from '@hovod/db';
import { db } from '../db.js';
import { env } from '../env.js';
import { AppError, NotFoundError } from '../middleware/error-handler.js';
import { assertOwner } from '../middleware/auth.js';
import { getPlaybackUrls } from '../services/asset.js';
import { normalizeQuestions, parseJsonArray } from '../services/publishing.js';

const libraryQuery = z.object({
  status: z.enum([PUBLISHED_STATUS.DRAFT, PUBLISHED_STATUS.PUBLISHED, PUBLISHED_STATUS.ARCHIVED, 'unpublished']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const patchAssetBody = z.object({
  status: z.enum([PUBLISHED_STATUS.DRAFT, PUBLISHED_STATUS.PUBLISHED, PUBLISHED_STATUS.ARCHIVED]).optional(),
  categories: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
  tags: z.array(z.string().trim().min(1).max(64)).max(30).optional(),
  featured: z.boolean().optional(),
});

const quizQuestionSchema = z.object({
  id: z.string().trim().min(1).max(64).optional(),
  prompt: z.string().trim().min(1).max(500),
  choices: z.array(z.string().trim().min(1).max(200)).max(6).optional(),
  answer: z.string().trim().min(1).max(200),
  explanation: z.string().trim().max(500).optional(),
});

const putQuizBody = z.object({
  questions: z.array(quizQuestionSchema).max(10),
});

async function findOrgAsset(assetId: string, orgId: string) {
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.orgId, orgId)))
    .limit(1);
  if (!asset) throw new NotFoundError('Asset not found');
  return asset;
}

export async function ownerRoutes(app: FastifyInstance) {
  /* ─── Library: list org assets with publish + quiz state ── */
  app.get('/v1/owner/assets', async (request) => {
    assertOwner(request);
    if (!request.orgId) throw new AppError(400, 'Organization context missing');
    const query = libraryQuery.parse(request.query || {});

    const assetRows = await db
      .select({
        id: assets.id,
        title: assets.title,
        status: assets.status,
        playbackId: assets.playbackId,
        durationSec: assets.durationSec,
        sourceType: assets.sourceType,
        createdAt: assets.createdAt,
      })
      .from(assets)
      .where(and(eq(assets.orgId, request.orgId), inArray(assets.status, [ASSET_STATUS.READY, ASSET_STATUS.PROCESSING, ASSET_STATUS.QUEUED, ASSET_STATUS.ERROR])))
      .orderBy(desc(assets.createdAt))
      .limit(query.limit);

    const assetIds = assetRows.map((row) => row.id);
    const publishRows = assetIds.length
      ? await db.select().from(publishedAssets).where(inArray(publishedAssets.hovodAssetId, assetIds))
      : [];
    const quizRows = assetIds.length
      ? await db.select({ assetId: assetQuizzes.assetId, questions: assetQuizzes.questions }).from(assetQuizzes).where(inArray(assetQuizzes.assetId, assetIds))
      : [];

    const publishByAsset = new Map(publishRows.map((row) => [row.hovodAssetId, row]));
    const quizCountByAsset = new Map(quizRows.map((row) => [row.assetId, normalizeQuestions(row.questions).length]));

    // Per-asset engagement analytics (content tracking).
    const engagementByAsset = new Map<string, { views: number; completes: number; likes: number; saves: number; shares: number; comments: number }>();
    const bump = (id: string) => {
      const current = engagementByAsset.get(id) || { views: 0, completes: 0, likes: 0, saves: 0, shares: 0, comments: 0 };
      engagementByAsset.set(id, current);
      return current;
    };
    if (assetIds.length) {
      const eventRows = await db
        .select({ assetId: userVideoEvents.assetId, event: userVideoEvents.event })
        .from(userVideoEvents)
        .where(inArray(userVideoEvents.assetId, assetIds));
      for (const row of eventRows) {
        const e = bump(row.assetId);
        if (row.event === 'view') e.views += 1;
        else if (row.event === 'complete') e.completes += 1;
        else if (row.event === 'like') e.likes += 1;
        else if (row.event === 'unlike') e.likes = Math.max(0, e.likes - 1);
        else if (row.event === 'save') e.saves += 1;
        else if (row.event === 'unsave') e.saves = Math.max(0, e.saves - 1);
        else if (row.event === 'share') e.shares += 1;
      }
      const commentRows = await db
        .select({ assetId: comments.assetId })
        .from(comments)
        .where(inArray(comments.assetId, assetIds));
      for (const row of commentRows) bump(row.assetId).comments += 1;
    }

    const items = assetRows.map((row) => {
      const publish = publishByAsset.get(row.id);
      const publishStatus = publish ? publish.status : 'unpublished';
      return {
        id: row.id,
        title: row.title,
        assetStatus: row.status,
        publishStatus,
        featured: publish ? Boolean(publish.featured) : false,
        categories: publish ? parseJsonArray(publish.categories) : [],
        tags: publish ? parseJsonArray(publish.tags) : [],
        sourceUrl: publish?.sourceUrl ?? null,
        sourceTitle: publish?.sourceTitle ?? null,
        proposalId: publish?.proposalId ?? null,
        publishedAt: publish?.publishedAt ?? null,
        quizQuestionCount: quizCountByAsset.get(row.id) ?? 0,
        engagement: engagementByAsset.get(row.id) || { views: 0, completes: 0, likes: 0, saves: 0, shares: 0, comments: 0 },
        playbackId: row.playbackId,
        playbackUrl: row.status === ASSET_STATUS.READY ? getPlaybackUrls(row.id, row.playbackId).manifestUrl : null,
        duration: row.durationSec,
        source: row.sourceType,
        createdAt: row.createdAt,
      };
    });

    const filtered = query.status
      ? items.filter((item) => item.publishStatus === query.status)
      : items;

    return { data: { items: filtered } };
  });

  /* ─── Curate: publish / unpublish / categories / feature ── */
  app.patch<{ Params: { id: string } }>('/v1/owner/assets/:id', async (request) => {
    assertOwner(request);
    if (!request.orgId) throw new AppError(400, 'Organization context missing');
    await findOrgAsset(request.params.id, request.orgId);
    const body = patchAssetBody.parse(request.body || {});

    const [existing] = await db
      .select()
      .from(publishedAssets)
      .where(eq(publishedAssets.hovodAssetId, request.params.id))
      .limit(1);

    const normalizedCategories = body.categories
      ? [...new Set(body.categories.map((c) => c.toLowerCase()))]
      : undefined;
    const normalizedTags = body.tags
      ? [...new Set(body.tags.map((t) => t.toLowerCase()))]
      : undefined;

    if (!existing) {
      const status = body.status ?? PUBLISHED_STATUS.DRAFT;
      await db.insert(publishedAssets).values({
        hovodAssetId: request.params.id,
        status,
        categories: normalizedCategories ?? [],
        tags: normalizedTags ?? [],
        featured: body.featured ?? false,
        publishedAt: status === PUBLISHED_STATUS.PUBLISHED ? new Date() : null,
      });
    } else {
      const updates: Partial<typeof publishedAssets.$inferInsert> = {};
      if (body.status) {
        updates.status = body.status;
        if (body.status === PUBLISHED_STATUS.PUBLISHED && existing.status !== PUBLISHED_STATUS.PUBLISHED) {
          updates.publishedAt = new Date();
        }
      }
      if (normalizedCategories) updates.categories = normalizedCategories;
      if (normalizedTags) updates.tags = normalizedTags;
      if (typeof body.featured === 'boolean') updates.featured = body.featured;

      if (Object.keys(updates).length > 0) {
        await db.update(publishedAssets).set(updates).where(eq(publishedAssets.hovodAssetId, request.params.id));
      }
    }

    const [updated] = await db.select().from(publishedAssets).where(eq(publishedAssets.hovodAssetId, request.params.id)).limit(1);
    if (!updated) throw new AppError(500, 'Failed to update published asset');

    return {
      data: {
        id: updated.hovodAssetId,
        publishStatus: updated.status,
        featured: Boolean(updated.featured),
        categories: parseJsonArray(updated.categories),
        tags: parseJsonArray(updated.tags),
        publishedAt: updated.publishedAt,
      },
    };
  });

  /* ─── Quiz bank: read ────────────────────────────────────── */
  app.get<{ Params: { id: string } }>('/v1/owner/assets/:id/quiz', async (request) => {
    assertOwner(request);
    if (!request.orgId) throw new AppError(400, 'Organization context missing');
    await findOrgAsset(request.params.id, request.orgId);

    const [row] = await db.select().from(assetQuizzes).where(eq(assetQuizzes.assetId, request.params.id)).limit(1);
    return { data: { assetId: request.params.id, questions: row ? normalizeQuestions(row.questions) : [] } };
  });

  /* ─── Quiz bank: write (replace) ─────────────────────────── */
  app.put<{ Params: { id: string } }>('/v1/owner/assets/:id/quiz', async (request) => {
    assertOwner(request);
    if (!request.orgId) throw new AppError(400, 'Organization context missing');
    await findOrgAsset(request.params.id, request.orgId);
    const body = putQuizBody.parse(request.body || {});
    const questions = normalizeQuestions(body.questions);

    const [existing] = await db.select({ assetId: assetQuizzes.assetId }).from(assetQuizzes).where(eq(assetQuizzes.assetId, request.params.id)).limit(1);
    if (existing) {
      await db.update(assetQuizzes)
        .set({ questions, updatedBy: request.userId || 'owner' })
        .where(eq(assetQuizzes.assetId, request.params.id));
    } else {
      await db.insert(assetQuizzes).values({ assetId: request.params.id, questions, updatedBy: request.userId || 'owner' });
    }

    return { data: { assetId: request.params.id, questions } };
  });

  /* ─── Pipeline health ────────────────────────────────────── */
  app.get('/v1/owner/pipeline', async (request) => {
    assertOwner(request);

    const proposalRows = await db.select({ status: proposals.status }).from(proposals);
    const proposalsByStatus: Record<string, number> = {};
    for (const row of proposalRows) proposalsByStatus[row.status] = (proposalsByStatus[row.status] || 0) + 1;

    const jobRows = await db
      .select({ id: jobs.id, assetId: jobs.assetId, type: jobs.type, status: jobs.status, errorMessage: jobs.errorMessage, updatedAt: jobs.updatedAt })
      .from(jobs)
      .orderBy(desc(jobs.updatedAt))
      .limit(200);

    const jobsByStatus: Record<string, number> = {};
    for (const row of jobRows) jobsByStatus[row.status] = (jobsByStatus[row.status] || 0) + 1;
    const recentFailures = jobRows
      .filter((row) => row.status === 'failed')
      .slice(0, 10)
      .map((row) => ({ id: row.id, assetId: row.assetId, type: row.type, errorMessage: row.errorMessage, updatedAt: row.updatedAt }));

    let openreels: { reachable: boolean; error?: string } = { reachable: false };
    try {
      const response = await fetch(`${env.OPENREELS_API_URL.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(2500) });
      openreels = { reachable: response.ok, ...(response.ok ? {} : { error: `status ${response.status}` }) };
    } catch (error) {
      openreels = { reachable: false, error: (error as Error).message };
    }

    return {
      data: {
        proposals: { byStatus: proposalsByStatus, total: proposalRows.length },
        jobs: { byStatus: jobsByStatus, recentFailures },
        services: { openreels },
      },
    };
  });
}
