# Hovod Learn (Next.js)

TikTok-style Next.js app integrated with Hovod.

## Environment

Set these variables for server-side API routes:

- `HOVOD_API_BASE_URL` (default: `http://api:3000` in Docker Compose)
- `HOVOD_API_KEY` (required)
- `NEXT_PUBLIC_HOVOD_DASHBOARD_URL` (default: `http://localhost:3003`) for deep links to advanced dashboard sections

## Local run

```bash
npm install
npm run dev
```

The app uses Hovod endpoints for:

- listing assets
- metadata updates (likes/bookmarks)
- upload URL creation + upload completion
- video processing
- playback via HLS manifest

Learn-native routes are available for integration:

- `/upload` for video upload
- `/settings` for platform settings

Advanced sections stay in Dashboard and are deep-linked from Learn:

- analytics
- members
- API keys
