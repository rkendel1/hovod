import type { VideoMetadata } from '@hovod/contracts'

export type { VideoMetadata }

export interface VideoItem {
    videoId: string
    playbackId: string
    title: string
    status: string
    metadata: VideoMetadata[]
    manifestUrl: string | null
    categories?: string[]
    source?: string
    quizDue?: boolean
    progress?: {
        watchedSeconds: number
        completed: boolean
    }
}
