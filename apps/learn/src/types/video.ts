import type { VideoMetadata } from '@hovod/contracts'

export type { VideoMetadata }

export interface QuizQuestion {
    id: string
    prompt: string
    choices?: string[]
    answer: string
    explanation?: string
}

export interface VideoItem {
    videoId: string
    playbackId: string
    title: string
    status: string
    metadata: VideoMetadata[]
    manifestUrl: string | null
    categories?: string[]
    source?: string
    featured?: boolean
    quizDue?: boolean
    liked?: boolean
    saved?: boolean
    progress?: {
        watchedSeconds: number
        completed: boolean
    }
}
