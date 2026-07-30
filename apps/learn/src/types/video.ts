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
