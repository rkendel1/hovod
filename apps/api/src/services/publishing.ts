import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { assetQuizzes, publishedAssets, ID_LENGTH } from '@hovod/db';
import { db } from '../db.js';

/* ─── JSON helpers ───────────────────────────────────────── */

export const parseJsonArray = (value: unknown): string[] => {
  if (!value) return [];
  const raw = typeof value === 'string' ? (() => {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  })() : value;

  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());
  }
  if (typeof raw === 'string') {
    return raw.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

/* ─── Quiz question shape ────────────────────────────────── */

export interface QuizQuestion {
  id: string;
  prompt: string;
  choices?: string[];
  answer: string;
  explanation?: string;
}

/** Coerce arbitrary input into a validated list of quiz questions. */
export const normalizeQuestions = (input: unknown): QuizQuestion[] => {
  const raw = typeof input === 'string' ? (() => {
    try {
      return JSON.parse(input);
    } catch {
      return [];
    }
  })() : input;

  if (!Array.isArray(raw)) return [];

  const output: QuizQuestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : '';
    const answer = typeof record.answer === 'string' ? record.answer.trim() : '';
    if (!prompt || !answer) continue;

    const choices = Array.isArray(record.choices)
      ? record.choices.filter((c): c is string => typeof c === 'string' && c.trim().length > 0).map((c) => c.trim())
      : undefined;
    const explanation = typeof record.explanation === 'string' && record.explanation.trim()
      ? record.explanation.trim()
      : undefined;
    const id = typeof record.id === 'string' && record.id.trim()
      ? record.id.trim()
      : nanoid(ID_LENGTH.QUIZ_QUESTION);

    output.push({ id, prompt, ...(choices ? { choices } : {}), answer, ...(explanation ? { explanation } : {}) });
  }
  return output;
};

/**
 * Build a simple recall quiz from a proposal's key messages. Each key message
 * becomes a true/false retention check. Used to auto-seed a quiz when an asset
 * is generated through the pipeline.
 */
export const quizFromKeyMessages = (keyMessages: unknown): QuizQuestion[] => {
  const messages = parseJsonArray(keyMessages).slice(0, 3);
  return messages.map((message) => ({
    id: nanoid(ID_LENGTH.QUIZ_QUESTION),
    prompt: `Do you recall this key idea from the clip: "${message}"?`,
    choices: ['Yes, I remember', 'No, remind me'],
    answer: 'Yes, I remember',
    explanation: message,
  }));
};

/* ─── Upserts ────────────────────────────────────────────── */

/**
 * Ensure a published_assets row exists for a Hovod asset. Creates a draft when
 * absent (pipeline output starts as draft); never downgrades an existing row.
 */
export async function ensurePublishedDraft(
  hovodAssetId: string,
  meta: { categories?: string[]; tags?: string[]; sourceUrl?: string | null; sourceTitle?: string | null; proposalId?: string | null },
): Promise<void> {
  const [existing] = await db
    .select({ hovodAssetId: publishedAssets.hovodAssetId })
    .from(publishedAssets)
    .where(eq(publishedAssets.hovodAssetId, hovodAssetId))
    .limit(1);

  if (existing) return;

  await db.insert(publishedAssets).values({
    hovodAssetId,
    status: 'draft',
    categories: meta.categories ?? [],
    tags: meta.tags ?? [],
    featured: false,
    sourceUrl: meta.sourceUrl ?? null,
    sourceTitle: meta.sourceTitle ?? null,
    proposalId: meta.proposalId ?? null,
  });
}

/** Ensure an asset_quizzes row exists; never overwrites owner-edited content. */
export async function ensureAssetQuiz(assetId: string, questions: QuizQuestion[]): Promise<void> {
  if (questions.length === 0) return;
  const [existing] = await db
    .select({ assetId: assetQuizzes.assetId })
    .from(assetQuizzes)
    .where(eq(assetQuizzes.assetId, assetId))
    .limit(1);

  if (existing) return;

  await db.insert(assetQuizzes).values({ assetId, questions });
}
