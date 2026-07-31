import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import {
  ASSET_STATUS,
  ID_LENGTH,
  PUBLISHED_STATUS,
  assetQuizzes,
  assets,
  comments,
  proposals,
  publishedAssets,
  userPreferences,
  userQuizState,
  userVideoEvents,
  users,
} from '@hovod/db';
import { db } from '../db.js';
import { AppError, NotFoundError } from '../middleware/error-handler.js';
import { getPlaybackUrls } from '../services/asset.js';
import { normalizeQuestions, type QuizQuestion } from '../services/publishing.js';

const QUIZ_PERIOD_OPTIONS = [0, 1, 3, 7, 14, 30] as const;
const EVENT_TYPES = [
  'view', 'complete', 'skip', 'save', 'unsave', 'like', 'unlike', 'share',
  'quiz_shown', 'quiz_correct', 'quiz_wrong',
] as const;

const updatePreferencesBody = z.object({
  categories: z.array(z.string().trim().min(1).max(64)).min(1).max(20).optional(),
  quizPeriodDays: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(7), z.literal(14), z.literal(30)]).optional(),
  feedDiversity: z.number().min(0).max(1).optional(),
  onboardingCompleted: z.boolean().optional(),
});

const feedQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const eventBodySchema = z.object({
  assetId: z.string().min(1),
  event: z.enum(EVENT_TYPES),
  watchSeconds: z.number().int().min(0).max(60_000).optional(),
});

const quizAnswerBody = z.object({
  correct: z.boolean(),
});

const collectionQuery = z.object({
  type: z.enum(['saved', 'liked', 'commented']).default('saved'),
});

type PreferenceRow = typeof userPreferences.$inferSelect;

const parseJsonArray = (value: unknown): string[] => {
  if (!value) return [];
  const raw = typeof value === 'string' ? (() => {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  })() : value;

  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
  }

  if (typeof raw === 'string') {
    return raw.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
};

const normalizePreference = (row: PreferenceRow) => ({
  userId: row.userId,
  categories: parseJsonArray(row.categories),
  quizPeriodDays: row.quizPeriodDays,
  onboardingCompletedAt: row.onboardingCompletedAt,
  feedDiversity: Number(row.feedDiversity),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const plusDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const hash = (value: string): number => {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = ((h << 5) - h) + value.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const readCustomMetadata = (input: unknown): Record<string, string> => {
  if (!input) return {};
  const value = typeof input === 'string' ? (() => {
    try {
      return JSON.parse(input);
    } catch {
      return {};
    }
  })() : input;

  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const output: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string') output[key] = item;
  }
  return output;
};

const extractCategories = (
  publishedCategories: unknown,
  publishedTags: unknown,
  customMetadata: unknown,
  proposalData: { categories: unknown; tags: unknown; topics: unknown } | undefined,
): string[] => {
  const metadata = readCustomMetadata(customMetadata);
  const result = new Set<string>();

  // Owner-curated categories/tags take precedence, then metadata, then proposal.
  for (const category of parseJsonArray(publishedCategories)) result.add(category.toLowerCase());
  for (const tag of parseJsonArray(publishedTags)) result.add(tag.toLowerCase());

  for (const category of parseJsonArray(metadata.categories)) result.add(category.toLowerCase());
  for (const tag of parseJsonArray(metadata.tags)) result.add(tag.toLowerCase());
  for (const topic of parseJsonArray(metadata.topic)) result.add(topic.toLowerCase());

  if (proposalData) {
    for (const category of parseJsonArray(proposalData.categories)) result.add(category.toLowerCase());
    for (const tag of parseJsonArray(proposalData.tags)) result.add(tag.toLowerCase());
    for (const topic of parseJsonArray(proposalData.topics)) result.add(topic.toLowerCase());
  }

  return [...result];
};

async function ensurePreferences(userId: string): Promise<PreferenceRow> {
  const [existing] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  if (existing) return existing;

  await db.insert(userPreferences).values({
    userId,
    categories: [],
    quizPeriodDays: 7,
    feedDiversity: 0.3,
  });

  const [created] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  if (!created) throw new AppError(500, 'Failed to initialize user preferences');
  return created;
}

async function ensureOrgAsset(assetId: string, orgId: string): Promise<void> {
  const [asset] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.orgId, orgId)))
    .limit(1);

  if (!asset) throw new NotFoundError('Asset not found');
}

export async function learnRoutes(app: FastifyInstance) {
  app.get('/v1/learn/preferences', async (request) => {
    if (!request.userId) throw new AppError(401, 'Authentication required');
    const preferences = await ensurePreferences(request.userId);
    return { data: normalizePreference(preferences) };
  });

  app.patch('/v1/learn/preferences', async (request) => {
    if (!request.userId) throw new AppError(401, 'Authentication required');
    const body = updatePreferencesBody.parse(request.body || {});

    await ensurePreferences(request.userId);

    const updates: Partial<typeof userPreferences.$inferInsert> = {};
    if (body.categories) updates.categories = [...new Set(body.categories.map((item) => item.toLowerCase()))];
    if (typeof body.quizPeriodDays === 'number' && QUIZ_PERIOD_OPTIONS.includes(body.quizPeriodDays)) {
      updates.quizPeriodDays = body.quizPeriodDays;
    }
    if (typeof body.feedDiversity === 'number') updates.feedDiversity = body.feedDiversity;
    if (body.onboardingCompleted === true) updates.onboardingCompletedAt = new Date();
    if (body.onboardingCompleted === false) updates.onboardingCompletedAt = null;

    if (Object.keys(updates).length > 0) {
      await db.update(userPreferences).set(updates).where(eq(userPreferences.userId, request.userId));
    }

    const [updated] = await db.select().from(userPreferences).where(eq(userPreferences.userId, request.userId)).limit(1);
    if (!updated) throw new AppError(500, 'Failed to update user preferences');

    return { data: normalizePreference(updated) };
  });

  app.get('/v1/learn/feed', async (request) => {
    if (!request.userId) throw new AppError(401, 'Authentication required');
    if (!request.orgId) throw new AppError(400, 'Organization context missing');

    const query = feedQuerySchema.parse(request.query || {});
    const offset = query.cursor ? Math.max(0, Number.parseInt(query.cursor, 10) || 0) : 0;

    const preferences = normalizePreference(await ensurePreferences(request.userId));
    const preferredSet = new Set(preferences.categories.map((item) => item.toLowerCase()));

    // Feed eligibility is owner-driven: only assets an owner has published
    // (published_assets.status = 'published') enter the consumer pool.
    const candidates = await db
      .select({
        id: assets.id,
        title: assets.title,
        playbackId: assets.playbackId,
        durationSec: assets.durationSec,
        createdAt: assets.createdAt,
        sourceType: assets.sourceType,
        customMetadata: assets.customMetadata,
        publishedCategories: publishedAssets.categories,
        publishedTags: publishedAssets.tags,
        featured: publishedAssets.featured,
        publishedAt: publishedAssets.publishedAt,
      })
      .from(assets)
      .innerJoin(publishedAssets, eq(assets.id, publishedAssets.hovodAssetId))
      .where(and(
        eq(assets.orgId, request.orgId),
        eq(assets.status, ASSET_STATUS.READY),
        eq(publishedAssets.status, PUBLISHED_STATUS.PUBLISHED),
      ))
      .orderBy(desc(assets.createdAt))
      .limit(Math.max(query.limit * 8, 120));

    if (candidates.length === 0) {
      return { data: { items: [], nextCursor: null } };
    }

    const assetIds = candidates.map((item) => item.id);

    const proposalRows = assetIds.length === 0
      ? []
      : await db
        .select({
          hovodAssetId: proposals.hovodAssetId,
          categories: proposals.categories,
          tags: proposals.tags,
          topics: proposals.topics,
        })
        .from(proposals)
        .where(inArray(proposals.hovodAssetId, assetIds));

    const proposalByAssetId = new Map<string, { categories: unknown; tags: unknown; topics: unknown }>();
    for (const row of proposalRows) {
      if (row.hovodAssetId) {
        proposalByAssetId.set(row.hovodAssetId, {
          categories: row.categories,
          tags: row.tags,
          topics: row.topics,
        });
      }
    }

    const eventRows = await db
      .select({
        assetId: userVideoEvents.assetId,
        event: userVideoEvents.event,
        watchSeconds: userVideoEvents.watchSeconds,
        createdAt: userVideoEvents.createdAt,
      })
      .from(userVideoEvents)
      .where(eq(userVideoEvents.userId, request.userId))
      .orderBy(desc(userVideoEvents.createdAt))
      .limit(5000);

    const quizRows = await db
      .select({
        assetId: userQuizState.assetId,
        nextQuizAt: userQuizState.nextQuizAt,
      })
      .from(userQuizState)
      .where(eq(userQuizState.userId, request.userId));

    const quizByAssetId = new Map<string, Date | null>();
    for (const row of quizRows) {
      quizByAssetId.set(row.assetId, row.nextQuizAt ? new Date(row.nextQuizAt) : null);
    }

    const eventByAssetId = new Map<string, {
      viewCount: number;
      completeCount: number;
      skipCount: number;
      saveCount: number;
      saved: boolean;
      liked: boolean;
      maxWatchSeconds: number;
      lastCompleteAt: Date | null;
    }>();

    // eventRows are ordered newest-first; the first save/unsave (or like/unlike)
    // we encounter for an asset reflects the current toggle state.
    const savedResolved = new Set<string>();
    const likedResolved = new Set<string>();

    for (const row of eventRows) {
      const state = eventByAssetId.get(row.assetId) || {
        viewCount: 0,
        completeCount: 0,
        skipCount: 0,
        saveCount: 0,
        saved: false,
        liked: false,
        maxWatchSeconds: 0,
        lastCompleteAt: null,
      };

      if (row.event === 'view') state.viewCount += 1;
      if (row.event === 'complete') {
        state.completeCount += 1;
        if (!state.lastCompleteAt || row.createdAt > state.lastCompleteAt) state.lastCompleteAt = row.createdAt;
      }
      if (row.event === 'skip') state.skipCount += 1;
      if (row.event === 'save') state.saveCount += 1;
      if ((row.event === 'save' || row.event === 'unsave') && !savedResolved.has(row.assetId)) {
        state.saved = row.event === 'save';
        savedResolved.add(row.assetId);
      }
      if ((row.event === 'like' || row.event === 'unlike') && !likedResolved.has(row.assetId)) {
        state.liked = row.event === 'like';
        likedResolved.add(row.assetId);
      }
      if (typeof row.watchSeconds === 'number') state.maxWatchSeconds = Math.max(state.maxWatchSeconds, row.watchSeconds);

      eventByAssetId.set(row.assetId, state);
    }

    const now = new Date();
    const ranked = candidates.map((candidate) => {
      const categories = extractCategories(
        candidate.publishedCategories,
        candidate.publishedTags,
        candidate.customMetadata,
        proposalByAssetId.get(candidate.id),
      );
      const matches = categories.filter((category) => preferredSet.has(category)).length;
      const categoryScore = preferredSet.size > 0 ? matches / preferredSet.size : 0.15;

      const ageDays = Math.max(0, (now.getTime() - candidate.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const recencyScore = 1 / (1 + (ageDays / 7));

      const events = eventByAssetId.get(candidate.id);
      const completed = Boolean(events && events.completeCount > 0);
      const recentlyCompletedPenalty = events?.lastCompleteAt
        ? Math.max(0, 1 - ((now.getTime() - events.lastCompleteAt.getTime()) / (1000 * 60 * 60 * 24 * 30))) * 0.4
        : 0;
      const skipPenalty = Math.min((events?.skipCount || 0) * 0.08, 0.32);
      const saveBoost = Math.min((events?.saveCount || 0) * 0.05, 0.2);
      const diversityBoost = (hash(candidate.id) % 1000) / 1000 * preferences.feedDiversity * 0.15;
      const featuredBoost = candidate.featured ? 0.15 : 0;

      const score = (categoryScore * 0.55)
        + (recencyScore * 0.35)
        + saveBoost
        + diversityBoost
        + featuredBoost
        - skipPenalty
        - recentlyCompletedPenalty;

      const nextQuizAt = quizByAssetId.get(candidate.id);
      const quizDue = preferences.quizPeriodDays > 0
        && completed
        && !!nextQuizAt
        && nextQuizAt.getTime() <= now.getTime();

      return {
        ...candidate,
        categories,
        featured: Boolean(candidate.featured),
        score,
        quizDue,
        liked: Boolean(events?.liked),
        saved: Boolean(events?.saved),
        progress: {
          watchedSeconds: events?.maxWatchSeconds || 0,
          completed,
        },
      };
    });

    ranked.sort((a, b) => b.score - a.score);

    const pageItems = ranked.slice(offset, offset + query.limit);
    const nextCursor = (offset + query.limit) < ranked.length ? String(offset + query.limit) : null;

    return {
      data: {
        items: pageItems.map((item) => ({
          id: item.id,
          title: item.title,
          playbackId: item.playbackId,
          playbackUrl: getPlaybackUrls(item.id, item.playbackId).manifestUrl,
          duration: item.durationSec,
          categories: item.categories,
          source: item.sourceType,
          featured: item.featured,
          quizDue: item.quizDue,
          liked: item.liked,
          saved: item.saved,
          progress: item.progress,
        })),
        nextCursor,
      },
    };
  });

  app.post('/v1/learn/events', async (request) => {
    if (!request.userId) throw new AppError(401, 'Authentication required');
    if (!request.orgId) throw new AppError(400, 'Organization context missing');

    const body = eventBodySchema.parse(request.body || {});
    await ensureOrgAsset(body.assetId, request.orgId);

    await db.insert(userVideoEvents).values({
      id: nanoid(ID_LENGTH.ANALYTICS_EVENT),
      userId: request.userId,
      assetId: body.assetId,
      event: body.event,
      watchSeconds: body.watchSeconds,
    });

    if (body.event === 'complete') {
      const preferences = normalizePreference(await ensurePreferences(request.userId));
      if (preferences.quizPeriodDays > 0) {
        const [existingState] = await db
          .select()
          .from(userQuizState)
          .where(and(eq(userQuizState.userId, request.userId), eq(userQuizState.assetId, body.assetId)))
          .limit(1);

        if (!existingState) {
          await db.insert(userQuizState).values({
            id: nanoid(ID_LENGTH.JOB),
            userId: request.userId,
            assetId: body.assetId,
            nextQuizAt: plusDays(new Date(), preferences.quizPeriodDays),
            correctCount: 0,
            wrongCount: 0,
          });
        }
      }
    }

    return { data: { ok: true } };
  });

  app.get('/v1/learn/profile', async (request) => {
    if (!request.userId) throw new AppError(401, 'Authentication required');

    const preferences = normalizePreference(await ensurePreferences(request.userId));

    const events = await db
      .select({ assetId: userVideoEvents.assetId, event: userVideoEvents.event, createdAt: userVideoEvents.createdAt })
      .from(userVideoEvents)
      .where(eq(userVideoEvents.userId, request.userId))
      .orderBy(desc(userVideoEvents.createdAt))
      .limit(5000);

    const completedAssets = new Set<string>();
    const savedResolved = new Map<string, boolean>();
    const likedResolved = new Map<string, boolean>();
    const activeDays = new Set<string>();
    let views = 0;
    let shares = 0;

    for (const row of events) {
      activeDays.add(row.createdAt.toISOString().slice(0, 10));
      if (row.event === 'view') views += 1;
      if (row.event === 'complete') completedAssets.add(row.assetId);
      if (row.event === 'share') shares += 1;
      if ((row.event === 'save' || row.event === 'unsave') && !savedResolved.has(row.assetId)) {
        savedResolved.set(row.assetId, row.event === 'save');
      }
      if ((row.event === 'like' || row.event === 'unlike') && !likedResolved.has(row.assetId)) {
        likedResolved.set(row.assetId, row.event === 'like');
      }
    }

    const savedAssetIds = [...savedResolved.entries()].filter(([, v]) => v).map(([id]) => id);
    const likedAssetIds = [...likedResolved.entries()].filter(([, v]) => v).map(([id]) => id);

    const quizStates = await db
      .select({ correctCount: userQuizState.correctCount, wrongCount: userQuizState.wrongCount })
      .from(userQuizState)
      .where(eq(userQuizState.userId, request.userId));

    let quizCorrect = 0;
    let quizWrong = 0;
    for (const state of quizStates) {
      quizCorrect += state.correctCount;
      quizWrong += state.wrongCount;
    }
    const quizTotal = quizCorrect + quizWrong;

    // Per-category breakdown across completed assets (from the published layer).
    const completedIds = [...completedAssets];
    const categoryCounts: Record<string, number> = {};
    if (completedIds.length > 0) {
      const pubRows = await db
        .select({ hovodAssetId: publishedAssets.hovodAssetId, categories: publishedAssets.categories })
        .from(publishedAssets)
        .where(inArray(publishedAssets.hovodAssetId, completedIds));
      for (const row of pubRows) {
        for (const category of parseJsonArray(row.categories)) {
          categoryCounts[category] = (categoryCounts[category] || 0) + 1;
        }
      }
    }
    const topCategories = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, count]) => ({ category, count }));

    return {
      data: {
        preferences: {
          categories: preferences.categories,
          quizPeriodDays: preferences.quizPeriodDays,
        },
        stats: {
          clipsViewed: views,
          clipsCompleted: completedAssets.size,
          saved: savedAssetIds.length,
          liked: likedAssetIds.length,
          shares,
          activeDays: activeDays.size,
          quiz: {
            correct: quizCorrect,
            wrong: quizWrong,
            total: quizTotal,
            accuracy: quizTotal > 0 ? Math.round((quizCorrect / quizTotal) * 100) : null,
          },
        },
        topCategories,
        savedAssetIds,
        likedAssetIds,
      },
    };
  });

  app.get('/v1/learn/collections', async (request) => {
    if (!request.userId) throw new AppError(401, 'Authentication required');
    if (!request.orgId) throw new AppError(400, 'Organization context missing');

    const parsed = collectionQuery.parse(request.query || {});
    const type = parsed.type;

    let assetIds: string[] = [];

    if (type === 'commented') {
      const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, request.userId)).limit(1);
      if (user?.email) {
        const rows = await db
          .select({ assetId: comments.assetId, createdAt: comments.createdAt })
          .from(comments)
          .where(eq(comments.authorEmail, user.email))
          .orderBy(desc(comments.createdAt));
        assetIds = [...new Set(rows.map((row) => row.assetId))];
      }
    } else {
      // saved | liked — resolve net toggle state from newest-first events.
      const positive = type === 'saved' ? 'save' : 'like';
      const negative = type === 'saved' ? 'unsave' : 'unlike';
      const rows = await db
        .select({ assetId: userVideoEvents.assetId, event: userVideoEvents.event })
        .from(userVideoEvents)
        .where(and(
          eq(userVideoEvents.userId, request.userId),
          inArray(userVideoEvents.event, [positive, negative]),
        ))
        .orderBy(desc(userVideoEvents.createdAt));
      const resolved = new Map<string, boolean>();
      for (const row of rows) {
        if (!resolved.has(row.assetId)) resolved.set(row.assetId, row.event === positive);
      }
      assetIds = [...resolved.entries()].filter(([, v]) => v).map(([id]) => id);
    }

    if (assetIds.length === 0) return { data: { type, items: [] } };

    const assetRows = await db
      .select({
        id: assets.id,
        title: assets.title,
        playbackId: assets.playbackId,
        durationSec: assets.durationSec,
        status: assets.status,
      })
      .from(assets)
      .where(and(eq(assets.orgId, request.orgId), inArray(assets.id, assetIds)))
      .limit(200);

    const order = new Map(assetIds.map((id, index) => [id, index]));
    const items = assetRows
      .filter((row) => row.status === ASSET_STATUS.READY)
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((row) => ({
        id: row.id,
        title: row.title,
        playbackId: row.playbackId,
        playbackUrl: getPlaybackUrls(row.id, row.playbackId).manifestUrl,
        duration: row.durationSec,
      }));

    return { data: { type, items } };
  });

  app.get<{ Params: { assetId: string } }>('/v1/learn/quizzes/:assetId', async (request) => {
    if (!request.userId) throw new AppError(401, 'Authentication required');
    if (!request.orgId) throw new AppError(400, 'Organization context missing');

    await ensureOrgAsset(request.params.assetId, request.orgId);
    const preferences = normalizePreference(await ensurePreferences(request.userId));

    if (preferences.quizPeriodDays === 0) {
      return { data: { quizDue: false, disabled: true } };
    }

    const [state] = await db
      .select()
      .from(userQuizState)
      .where(and(eq(userQuizState.userId, request.userId), eq(userQuizState.assetId, request.params.assetId)))
      .limit(1);

    const now = new Date();
    const quizDue = !!state?.nextQuizAt && state.nextQuizAt.getTime() <= now.getTime();

    let questions: QuizQuestion[] = [];
    if (quizDue) {
      const [quiz] = await db
        .select({ questions: assetQuizzes.questions })
        .from(assetQuizzes)
        .where(eq(assetQuizzes.assetId, request.params.assetId))
        .limit(1);
      questions = quiz ? normalizeQuestions(quiz.questions).slice(0, 3) : [];

      // Fallback so the retention loop still works before a quiz bank is authored.
      if (questions.length === 0) {
        questions = [{
          id: 'recall',
          prompt: 'Quick check: do you still remember the key idea from this clip?',
          choices: ['Yes, I remember', 'No, remind me'],
          answer: 'Yes, I remember',
        }];
      }

      await db.insert(userVideoEvents).values({
        id: nanoid(ID_LENGTH.ANALYTICS_EVENT),
        userId: request.userId,
        assetId: request.params.assetId,
        event: 'quiz_shown',
      });
    }

    return {
      data: {
        quizDue,
        disabled: false,
        questions,
        // Back-compat single-question hint for older clients.
        question: quizDue && questions[0] ? questions[0].prompt : null,
      },
    };
  });

  app.post<{ Params: { assetId: string } }>('/v1/learn/quizzes/:assetId', async (request) => {
    if (!request.userId) throw new AppError(401, 'Authentication required');
    if (!request.orgId) throw new AppError(400, 'Organization context missing');

    await ensureOrgAsset(request.params.assetId, request.orgId);
    const { correct } = quizAnswerBody.parse(request.body || {});
    const preferences = normalizePreference(await ensurePreferences(request.userId));

    const [state] = await db
      .select()
      .from(userQuizState)
      .where(and(eq(userQuizState.userId, request.userId), eq(userQuizState.assetId, request.params.assetId)))
      .limit(1);

    const currentCorrect = state?.correctCount || 0;
    const currentWrong = state?.wrongCount || 0;
    const nextCorrect = correct ? currentCorrect + 1 : currentCorrect;
    const nextWrong = correct ? currentWrong : currentWrong + 1;

    const attempts = nextCorrect + nextWrong;
    const multiplier = attempts <= 1 ? 1 : attempts === 2 ? 2 : 4;
    const now = new Date();
    const nextQuizAt = preferences.quizPeriodDays > 0 ? plusDays(now, preferences.quizPeriodDays * multiplier) : null;

    if (!state) {
      await db.insert(userQuizState).values({
        id: nanoid(ID_LENGTH.JOB),
        userId: request.userId,
        assetId: request.params.assetId,
        lastQuizAt: now,
        nextQuizAt,
        correctCount: nextCorrect,
        wrongCount: nextWrong,
      });
    } else {
      await db.update(userQuizState)
        .set({
          lastQuizAt: now,
          nextQuizAt,
          correctCount: nextCorrect,
          wrongCount: nextWrong,
        })
        .where(eq(userQuizState.id, state.id));
    }

    await db.insert(userVideoEvents).values({
      id: nanoid(ID_LENGTH.ANALYTICS_EVENT),
      userId: request.userId,
      assetId: request.params.assetId,
      event: correct ? 'quiz_correct' : 'quiz_wrong',
    });

    return {
      data: {
        correct,
        nextQuizAt,
        correctCount: nextCorrect,
        wrongCount: nextWrong,
      },
    };
  });
}
