# Unified Learn Product — Front Door, Back Door, One Pipeline

The Learn app (`apps/learn`) is a single Next.js product with role-based surfaces
layered over the Hovod video platform. This document describes the consumer front
door, the owner back door, the pushed-distribution pipeline, the canonical data
model, and the APIs — plus the acceptance criteria the implementation targets.

## Roles

Effective role lives on the user record (`users.role`) and is carried in the JWT.

| Role | Who | Surfaces |
|------|-----|----------|
| `user` | End users (default on signup) | Front door only |
| `owner` | Platform operators | Front door **and** back door |

Grant owner on signup by listing emails in `OWNER_EMAILS`. API keys (`mk_live_…`)
act as an organization operator and are treated as `owner`. The bootstrap
`admin@localhost` account is an owner.

**Only owners publish content. There is no consumer-created content.** A clip
reaches the consumer feed only after an owner publishes it.

## Consumer flow (front door)

```
Landing → Sign up / Log in (email + password)
  → Onboarding (once): categories (multi-select) + quiz cadence (1/3/7/14/30 days or Off)
  → Home = personal pushed stream (vertical clips ranked for this user)
       • like / save / share on every clip
       • retention quiz fires after eligible completed clips, on the user's schedule
  → Library: saved / liked / commented collections
  → Profile: learning stats (completions, quiz accuracy, streak, top topics)
  → Settings: categories, quiz cadence, account
```

Rules:
- The stream is account-scoped (preferences + history + quiz state).
- Content is **pushed**: the server ranks and serves the next items.
- Quizzes only fire when `quizPeriodDays > 0` and `nextQuizAt <= now` for that user+asset.
- Logged-out users only see the landing + auth pages.

## Owner flow (back door)

```
/owner            Overview + pipeline snapshot
/owner/proposals  Curate bot-discovered ideas → approve pushes into OpenReels
/owner/library    Publish / unpublish / feature / tag; per-clip engagement analytics
/owner/quizzes    Author retention questions per asset
/owner/pipeline   Generation jobs, failures, OpenReels service status
```

## Producer → distribution pipeline

```
Discovery workers → candidates
  → Analyzer workers → summary, key messages, quality
  → Proposal workers → ContentProposal (script, imagery, categories)
  → [owner approves] → OpenReels job → vertical MP4
  → Publisher → Hovod asset + HLS  → published_assets (draft) + auto quiz from key messages
  → [owner publishes] → status = published → eligible for the consumer feed
  → Consumer feed API → personal rank + per-user quiz schedule
```

Once an asset is `published`, feed ranking pulls it for every user whose categories
overlap. No per-clip subscribe — distribution is preference + publish state.

## Data model (canonical)

- **`users`** — `{ id, email, passwordHash, name, role: 'user' | 'owner' }`
- **`user_preferences`** — `{ userId, categories[], quizPeriodDays, onboardingCompletedAt, feedDiversity }`
- **`user_video_events`** — `{ userId, assetId, event, watchSeconds? }`; events:
  `view | complete | skip | save | unsave | like | unlike | share | quiz_shown | quiz_correct | quiz_wrong`
- **`user_quiz_state`** — `{ userId, assetId, lastQuizAt, nextQuizAt, correctCount, wrongCount }` (per-user schedule)
- **`published_assets`** — owner curation layer keyed by Hovod asset id:
  `{ hovodAssetId, status: 'draft' | 'published' | 'archived', categories[], tags[], featured, sourceUrl, sourceTitle, proposalId, publishedAt }`
- **`asset_quizzes`** — shared quiz content per asset:
  `{ assetId, questions: { id, prompt, choices?, answer, explanation? }[] }`
- **`proposals`** — upstream ContentProposal (script, imagery, categories, quality, …)

## Consumer APIs (via the Learn proxy → Hovod `/v1/learn/*`)

| Method | Path | Purpose |
|--------|------|---------|
| GET / PATCH | `/api/me/preferences` | Load / update categories + quiz cadence |
| POST | `/api/me/onboarding/complete` | Persist onboarding |
| GET | `/api/feed?cursor&limit` | Personal pushed stream (published only) |
| POST | `/api/events` | view / complete / skip / save / like / share … |
| GET | `/api/collections?type=saved\|liked\|commented` | Reach saved / liked / commented clips |
| GET | `/api/profile` | Learning stats + top topics |
| GET | `/api/quizzes/:assetId` | Due questions for this user |
| POST | `/api/quizzes/:assetId` | Record result; reschedule `nextQuizAt` |

### Feed ranking

1. Load user categories + recent events.
2. Candidate set: assets that are `ready` **and** have `published_assets.status = 'published'`, in the org.
3. Rank: category match, freshness, featured boost, save boost; penalize skips and recently-completed; small diversity slice.
4. Annotate `quizDue` from `user_quiz_state`.
5. Return Hovod playback URLs.

### Quiz scheduling

On `complete`, seed `nextQuizAt = now + quizPeriodDays` (if cadence > 0). On answer,
reschedule with light spaced repetition (`1× → 2× → 4×` the period as attempts grow).
If `quizPeriodDays === 0`, never schedule and never return quiz payloads.

## Owner APIs (Hovod `/v1/owner/*`, owner-gated)

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/proposals` | List / trigger discovery |
| POST | `/api/proposals/:id/approve` | Approve → enqueue OpenReels |
| POST | `/api/proposals/:id/reject` | Reject |
| GET | `/api/owner/assets` | Library (publish state + engagement analytics) |
| PATCH | `/api/owner/assets/:id` | Publish / unpublish / feature / categories / tags |
| GET/PUT | `/api/owner/assets/:id/quiz` | Read / set quiz questions |
| GET | `/api/owner/pipeline` | Job status, failures, OpenReels health |

## Acceptance criteria

**Consumer**
- Land → signup → onboarding (categories + quiz period) → personal stream.
- Stream only includes published assets aligned to prefs (with controlled exploration).
- Events recorded; ranking reflects them.
- Quizzes appear only on the user's schedule; answers reschedule correctly.
- Settings update prefs without re-onboarding.

**Owner**
- Proposal inbox → approve → OpenReels → Hovod → draft asset.
- Publish / unpublish controls feed eligibility.
- Quiz questions attachable per asset.

**Pipeline**
- No manual file hand-offs between generate and feed.
- One asset id path: the Hovod id is used in events, quizzes, and the feed.
