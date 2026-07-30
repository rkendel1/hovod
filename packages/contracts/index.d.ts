export interface VideoMetadata {
  key: string
  value: string
}

export interface VideoItem {
  videoId: string
  playbackId: string
  title: string
  status: string
  metadata: VideoMetadata[]
  manifestUrl: string | null
}

export interface AiOptions {
  transcription: boolean
  subtitles: boolean
  chapters: boolean
}

export interface ServerConfig {
  aiAvailable: boolean
  chaptersAvailable: boolean
}

export interface PlatformSettings {
  primaryColor: string
  theme: 'light' | 'dark'
  logoUrl: string | null
  aiAutoTranscribe: boolean
  aiAutoChapter: boolean
}

export declare const BFF_ROUTES: {
  videos: '/api/videos'
  videoStatus: (videoId: string) => string
  settings: '/api/settings'
  settingsLogo: '/api/settings/logo'
}

export declare const DASHBOARD_PATHS: {
  videos: '/videos'
  newVideo: '/videos/new'
  analytics: '/analytics'
  members: '/members'
  apiKeys: '/api-keys'
  settings: '/settings'
}

export declare const DEFAULT_AI_OPTIONS: AiOptions
export declare const DEFAULT_PLATFORM_SETTINGS: PlatformSettings
export declare const VALID_SETTINGS_THEMES: Array<'light' | 'dark'>

export declare function deriveAssetTitle(inputTitle?: string | null, fallbackFileName?: string | null): string
export declare function normalizeHexColor(value?: string | null, fallback?: string): string
