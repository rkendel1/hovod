import React, { useEffect, useRef, useState } from 'react'
import Footer from '../footer'
import Sidebar from '../sidebar'
import styles from './videos.module.css'
import Hls from 'hls.js'
import type { VideoItem } from '../../types/video'

export interface IvideosProps {
    video: VideoItem
    mutate: () => void
}

const VideoComponent = ({ video, mutate }: IvideosProps) => {
    const [playing, setPlaying] = useState<boolean>(true)
    const [showQuizCard, setShowQuizCard] = useState<boolean>(false)
    const [quizSubmitting, setQuizSubmitting] = useState<boolean>(false)
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const viewTrackedRef = useRef<boolean>(false)
    const completeTrackedRef = useRef<boolean>(false)
    const maxWatchRef = useRef<number>(0)

    const trackEvent = async (event: string, watchSeconds?: number) => {
        await fetch('/api/events', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ assetId: video.videoId, event, ...(typeof watchSeconds === 'number' ? { watchSeconds } : {}) }),
        }).catch(() => undefined)
    }

    useEffect(() => {
        const element = videoRef.current
        if (!element || !video.manifestUrl) return

        if (element.canPlayType('application/vnd.apple.mpegurl')) {
            element.src = video.manifestUrl
            return
        }

        if (Hls.isSupported()) {
            const hls = new Hls()
            hls.loadSource(video.manifestUrl)
            hls.attachMedia(element)
            return () => hls.destroy()
        }
    }, [video.manifestUrl])

    useEffect(() => {
        viewTrackedRef.current = false
        completeTrackedRef.current = false
        maxWatchRef.current = video.progress?.watchedSeconds || 0
    }, [video.videoId, video.progress?.watchedSeconds])

    useEffect(() => () => {
        if (!completeTrackedRef.current && maxWatchRef.current >= 3) {
            void fetch('/api/events', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ assetId: video.videoId, event: 'skip', watchSeconds: Math.floor(maxWatchRef.current) }),
            }).catch(() => undefined)
        }
    }, [video.videoId])

    const onVideoPress = () => {
        if (playing) {
            videoRef.current?.pause()
            setPlaying(false)
            return
        }

        videoRef.current?.play()
        setPlaying(true)
    }

    const onLoadedData = () => {
        if (viewTrackedRef.current) return
        viewTrackedRef.current = true
        void trackEvent('view')
    }

    const onTimeUpdate = () => {
        const element = videoRef.current
        if (!element || !Number.isFinite(element.currentTime)) return

        maxWatchRef.current = Math.max(maxWatchRef.current, element.currentTime)
        const duration = element.duration || 0
        if (!completeTrackedRef.current && duration > 0 && (element.currentTime / duration) >= 0.9) {
            completeTrackedRef.current = true
            void trackEvent('complete', Math.floor(element.currentTime))
            if (video.quizDue) void openQuizCard()
        }
    }

    const answerQuiz = async (correct: boolean) => {
        setQuizSubmitting(true)
        await fetch(`/api/quizzes/${encodeURIComponent(video.videoId)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ correct }),
        }).catch(() => undefined)
        setQuizSubmitting(false)
        setShowQuizCard(false)
    }

    const openQuizCard = async () => {
        const response = await fetch(`/api/quizzes/${encodeURIComponent(video.videoId)}`)
        const payload = await response.json().catch(() => ({})) as { data?: { quizDue?: boolean } }
        if (response.ok && payload?.data?.quizDue) {
            setShowQuizCard(true)
        }
    }

    const height = typeof window !== 'undefined' ? window.screen.availHeight - 50 : 720
    const width = typeof window !== 'undefined' ? window.screen.width : 480

    return (
        <>
            {video && (
                <div className={styles.video} id={video.videoId}>
                    <video
                        ref={videoRef}
                        style={{
                            width,
                            height,
                            objectFit: 'cover',
                            scrollSnapAlign: 'start',
                            border: 0,
                        }}
                        autoPlay
                        loop
                        muted
                        playsInline
                        onLoadedData={onLoadedData}
                        onTimeUpdate={onTimeUpdate}
                    />
                    <div onClick={onVideoPress} className={styles.video__press}></div>
                    {video.quizDue && !showQuizCard && (
                        <button
                            onClick={() => void openQuizCard()}
                            style={{ position: 'absolute', top: 16, right: 16, zIndex: 4, borderRadius: 999, padding: '8px 12px' }}
                        >
                            Quiz due
                        </button>
                    )}
                    {showQuizCard && (
                        <div
                            style={{
                                position: 'absolute',
                                left: 12,
                                right: 12,
                                bottom: 140,
                                zIndex: 5,
                                background: 'rgba(24,24,27,0.95)',
                                borderRadius: 12,
                                padding: 12,
                            }}
                        >
                            <p style={{ marginTop: 0 }}>Do you still remember the key idea from this clip?</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button onClick={() => void answerQuiz(true)} disabled={quizSubmitting}>
                                    I remembered it
                                </button>
                                <button onClick={() => void answerQuiz(false)} disabled={quizSubmitting}>
                                    Need review
                                </button>
                            </div>
                        </div>
                    )}

                    <Footer video={video} />
                    <Sidebar video={video} mutate={mutate} />
                </div>
            )}
        </>
    )
}

export default VideoComponent
