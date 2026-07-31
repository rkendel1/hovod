import { double, int, json, mysqlTable, text, timestamp, varchar, index, uniqueIndex } from 'drizzle-orm/mysql-core';

export const assets = mysqlTable('assets', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('created'),
  sourceType: varchar('source_type', { length: 32 }).notNull().default('upload'),
  sourceKey: varchar('source_key', { length: 512 }),
  sourceUrl: varchar('source_url', { length: 2048 }),
  title: varchar('title', { length: 255 }).notNull(),
  playbackId: varchar('playback_id', { length: 64 }).notNull().unique(),
  metadata: json('metadata'),
  customMetadata: json('custom_metadata'),
  description: text('description'),
  publicSettings: json('public_settings'),
  customThumbnailKey: varchar('custom_thumbnail_key', { length: 512 }),
  durationSec: int('duration_sec'),
  errorMessage: varchar('error_message', { length: 1024 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  statusIdx: index('idx_assets_status').on(table.status),
  orgIdIdx: index('idx_assets_org_id').on(table.orgId),
}));

export const renditions = mysqlTable('renditions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  assetId: varchar('asset_id', { length: 36 }).notNull().references(() => assets.id, { onDelete: 'cascade' }),
  quality: varchar('quality', { length: 32 }).notNull(),
  width: int('width').notNull(),
  height: int('height').notNull(),
  bitrateKbps: int('bitrate_kbps').notNull(),
  fileSizeBytes: int('file_size_bytes'),
  codec: varchar('codec', { length: 32 }).notNull().default('h264'),
  playlistPath: varchar('playlist_path', { length: 1024 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  assetIdIdx: index('idx_renditions_asset_id').on(table.assetId),
}));

export const jobs = mysqlTable('jobs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  assetId: varchar('asset_id', { length: 36 }).notNull().references(() => assets.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 32 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  currentStep: varchar('current_step', { length: 64 }),
  attempts: int('attempts').notNull().default(0),
  errorMessage: varchar('error_message', { length: 1024 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  assetIdIdx: index('idx_jobs_asset_id').on(table.assetId),
  statusIdx: index('idx_jobs_status').on(table.status),
}));

/* ─── AI Processing tables ───────────────────────────────── */

export const aiJobs = mysqlTable('ai_jobs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  assetId: varchar('asset_id', { length: 36 }).notNull().references(() => assets.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 32 }).notNull().default('queued'),
  transcriptionStatus: varchar('transcription_status', { length: 32 }).notNull().default('pending'),
  subtitlesStatus: varchar('subtitles_status', { length: 32 }).notNull().default('pending'),
  chaptersStatus: varchar('chapters_status', { length: 32 }).notNull().default('pending'),
  transcriptPath: varchar('transcript_path', { length: 1024 }),
  subtitlesPath: varchar('subtitles_path', { length: 1024 }),
  chaptersPath: varchar('chapters_path', { length: 1024 }),
  language: varchar('language', { length: 16 }),
  errorMessage: varchar('error_message', { length: 1024 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  assetIdIdx: index('idx_ai_jobs_asset_id').on(table.assetId),
}));

/* ─── Analytics tables ───────────────────────────────────── */

export const analyticsEvents = mysqlTable('analytics_events', {
  id: varchar('id', { length: 36 }).primaryKey(),
  sessionId: varchar('session_id', { length: 36 }).notNull(),
  assetId: varchar('asset_id', { length: 36 }).notNull(),
  playbackId: varchar('playback_id', { length: 64 }).notNull(),
  eventType: varchar('event_type', { length: 32 }).notNull(),
  currentTime: int('current_time'),
  duration: int('duration'),
  qualityHeight: int('quality_height'),
  bufferDurationMs: int('buffer_duration_ms'),
  errorMessage: varchar('error_message', { length: 512 }),
  userAgent: varchar('user_agent', { length: 512 }),
  country: varchar('country', { length: 8 }),
  deviceType: varchar('device_type', { length: 16 }),
  referrer: varchar('referrer', { length: 2048 }),
  playerType: varchar('player_type', { length: 16 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  assetIdIdx: index('idx_analytics_events_asset_id').on(table.assetId),
  sessionIdx: index('idx_analytics_events_session').on(table.sessionId),
}));

export const analyticsDaily = mysqlTable('analytics_daily', {
  id: varchar('id', { length: 36 }).primaryKey(),
  assetId: varchar('asset_id', { length: 36 }).notNull(),
  date: varchar('date', { length: 10 }).notNull(),
  hour: int('hour'),
  viewCount: int('view_count').notNull().default(0),
  uniqueSessions: int('unique_sessions').notNull().default(0),
  totalWatchTimeSec: int('total_watch_time_sec').notNull().default(0),
  qualityDistribution: json('quality_distribution'),
  deviceDistribution: json('device_distribution'),
  bufferCount: int('buffer_count').notNull().default(0),
  totalBufferMs: int('total_buffer_ms').notNull().default(0),
  errorCount: int('error_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  assetDateIdx: index('idx_analytics_daily_asset_date').on(table.assetId, table.date),
}));

export const analyticsAssetStats = mysqlTable('analytics_asset_stats', {
  assetId: varchar('asset_id', { length: 36 }).primaryKey(),
  totalViews: int('total_views').notNull().default(0),
  totalUniqueSessions: int('total_unique_sessions').notNull().default(0),
  totalWatchTimeSec: int('total_watch_time_sec').notNull().default(0),
  avgWatchPercent: int('avg_watch_percent').notNull().default(0),
  engagementScore: int('engagement_score').notNull().default(0),
  retentionCurve: json('retention_curve'),
  peakHour: int('peak_hour'),
  qualityDistribution: json('quality_distribution'),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

/* ─── Platform Settings table ────────────────────────────── */

export const settings = mysqlTable('settings', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).references(() => organizations.id, { onDelete: 'cascade' }),
  primaryColor: varchar('primary_color', { length: 7 }).notNull().default('#4f46e5'),
  theme: varchar('theme', { length: 8 }).notNull().default('dark'),
  logoKey: varchar('logo_key', { length: 512 }),
  aiAutoTranscribe: varchar('ai_auto_transcribe', { length: 5 }).notNull().default('true'),
  aiAutoChapter: varchar('ai_auto_chapter', { length: 5 }).notNull().default('true'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  orgIdIdx: index('idx_settings_org_id').on(table.orgId),
}));

/* ─── Comments table ────────────────────────────────────── */

export const comments = mysqlTable('comments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  assetId: varchar('asset_id', { length: 36 }).notNull().references(() => assets.id, { onDelete: 'cascade' }),
  playbackId: varchar('playback_id', { length: 64 }).notNull(),
  authorName: varchar('author_name', { length: 100 }).notNull(),
  authorEmail: varchar('author_email', { length: 255 }).notNull(),
  body: varchar('body', { length: 2000 }).notNull(),
  timestampSec: int('timestamp_sec'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  playbackIdIdx: index('idx_comments_playback_id').on(table.playbackId),
  assetIdIdx: index('idx_comments_asset_id').on(table.assetId),
  createdAtIdx: index('idx_comments_created_at').on(table.createdAt),
}));

/* ─── Reactions table ──────────────────────────────────── */

export const reactions = mysqlTable('reactions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  assetId: varchar('asset_id', { length: 36 }).notNull().references(() => assets.id, { onDelete: 'cascade' }),
  playbackId: varchar('playback_id', { length: 64 }).notNull(),
  emoji: varchar('emoji', { length: 20 }).notNull(),
  sessionId: varchar('session_id', { length: 64 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  playbackEmojiIdx: index('idx_reactions_playback_emoji').on(table.playbackId, table.emoji),
  assetIdIdx: index('idx_reactions_asset_id').on(table.assetId),
}));

/* ─── Proposal pipeline tables ───────────────────────────── */

export const proposalCandidates = mysqlTable('proposal_candidates', {
  id: varchar('id', { length: 36 }).primaryKey(),
  sourceType: varchar('source_type', { length: 32 }).notNull(),
  canonicalKey: varchar('canonical_key', { length: 512 }).notNull(),
  canonicalId: varchar('canonical_id', { length: 255 }),
  url: varchar('url', { length: 2048 }).notNull(),
  title: varchar('title', { length: 512 }).notNull(),
  rawMeta: json('raw_meta'),
  analysis: json('analysis'),
  status: varchar('status', { length: 32 }).notNull().default('discovered'),
  errorMessage: varchar('error_message', { length: 1024 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
}, (table) => ({
  sourceTypeIdx: index('idx_pc_source_type').on(table.sourceType),
  statusIdx: index('idx_pc_status').on(table.status),
  canonicalKeyUq: uniqueIndex('uq_pc_canonical_key').on(table.canonicalKey),
}));

export const proposals = mysqlTable('proposals', {
  id: varchar('id', { length: 36 }).primaryKey(),
  candidateId: varchar('candidate_id', { length: 36 }).notNull()
    .references(() => proposalCandidates.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 32 }).notNull().default('pending'),
  source: json('source').notNull(),
  summary: text('summary').notNull(),
  keyMessages: json('key_messages').notNull(),
  targetAudience: varchar('target_audience', { length: 255 }),
  difficulty: varchar('difficulty', { length: 32 }).notNull(),
  proposedTitle: varchar('proposed_title', { length: 255 }).notNull(),
  scriptOutline: text('script_outline').notNull(),
  fullScriptDraft: text('full_script_draft'),
  visualDirection: json('visual_direction').notNull(),
  categories: json('categories').notNull(),
  tags: json('tags').notNull(),
  topics: json('topics').notNull(),
  qualityScore: int('quality_score').notNull(),
  qualityRationale: text('quality_rationale').notNull(),
  sourceQualitySignals: json('source_quality_signals').notNull(),
  openreelsJobId: varchar('openreels_job_id', { length: 64 }),
  hovodAssetId: varchar('hovod_asset_id', { length: 36 }),
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: varchar('reviewed_by', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  statusIdx: index('idx_proposals_status').on(table.status),
  candidateIdUq: uniqueIndex('uq_proposals_candidate_id').on(table.candidateId),
  openreelsJobIdx: index('idx_proposals_openreels_job_id').on(table.openreelsJobId),
}));

/* ─── Auth & Organization tables ─────────────────────────── */

export const users = mysqlTable('users', {
  id: varchar('id', { length: 36 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export const organizations = mysqlTable('organizations', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  ownerId: varchar('owner_id', { length: 36 }).notNull().references(() => users.id),
  tier: varchar('tier', { length: 32 }).notNull().default('free'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  webhookUrl: varchar('webhook_url', { length: 2048 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export const orgMembers = mysqlTable('org_members', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 32 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgIdIdx: index('idx_org_members_org_id').on(table.orgId),
  userIdIdx: index('idx_org_members_user_id').on(table.userId),
}));

export const apiKeys = mysqlTable('api_keys', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
  keyPrefix: varchar('key_prefix', { length: 12 }).notNull(),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  orgIdIdx: index('idx_api_keys_org_id').on(table.orgId),
}));

export const userPreferences = mysqlTable('user_preferences', {
  userId: varchar('user_id', { length: 36 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  categories: json('categories').notNull(),
  quizPeriodDays: int('quiz_period_days').notNull().default(7),
  onboardingCompletedAt: timestamp('onboarding_completed_at'),
  feedDiversity: double('feed_diversity').notNull().default(0.3),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

export const userVideoEvents = mysqlTable('user_video_events', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  assetId: varchar('asset_id', { length: 36 }).notNull().references(() => assets.id, { onDelete: 'cascade' }),
  event: varchar('event', { length: 32 }).notNull(),
  watchSeconds: int('watch_seconds'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_user_video_events_user_id').on(table.userId),
  assetIdIdx: index('idx_user_video_events_asset_id').on(table.assetId),
  eventIdx: index('idx_user_video_events_event').on(table.event),
  createdAtIdx: index('idx_user_video_events_created_at').on(table.createdAt),
}));

export const userQuizState = mysqlTable('user_quiz_state', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  assetId: varchar('asset_id', { length: 36 }).notNull().references(() => assets.id, { onDelete: 'cascade' }),
  lastQuizAt: timestamp('last_quiz_at'),
  nextQuizAt: timestamp('next_quiz_at'),
  correctCount: int('correct_count').notNull().default(0),
  wrongCount: int('wrong_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (table) => ({
  userAssetUq: uniqueIndex('uq_user_quiz_state_user_asset').on(table.userId, table.assetId),
  userIdIdx: index('idx_user_quiz_state_user_id').on(table.userId),
  assetIdIdx: index('idx_user_quiz_state_asset_id').on(table.assetId),
}));
