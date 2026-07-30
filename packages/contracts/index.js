export const BFF_ROUTES = {
  videos: '/api/videos',
  videoStatus: (videoId) => `/api/videos/${videoId}`,
  settings: '/api/settings',
  settingsLogo: '/api/settings/logo',
};

export const DASHBOARD_PATHS = {
  videos: '/videos',
  newVideo: '/videos/new',
  analytics: '/analytics',
  members: '/members',
  apiKeys: '/api-keys',
  settings: '/settings',
};

export const DEFAULT_AI_OPTIONS = {
  transcription: true,
  subtitles: true,
  chapters: true,
};

export const DEFAULT_PLATFORM_SETTINGS = {
  primaryColor: '#4f46e5',
  theme: 'dark',
  logoUrl: null,
  aiAutoTranscribe: true,
  aiAutoChapter: true,
};

export const VALID_SETTINGS_THEMES = ['light', 'dark'];

export function deriveAssetTitle(inputTitle, fallbackFileName) {
  const trimmed = (inputTitle || '').trim();
  if (trimmed) return trimmed;
  if (!fallbackFileName) return 'Uploaded video';
  return fallbackFileName.replace(/\.[^/.]+$/, '').trim() || 'Uploaded video';
}

export function normalizeHexColor(value, fallback = DEFAULT_PLATFORM_SETTINGS.primaryColor) {
  if (typeof value !== 'string') return fallback;
  const candidate = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate : fallback;
}
