import Hls from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { theme } from '../../lib/theme'
import type { VideoItem } from '../../types/video'
import QuizCard from './QuizCard'

interface ClipCardProps {
    video: VideoItem
}

const trackEvent = (assetId: string, event: string, watchSeconds?: number) =>
    fetch('/api/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetId, event, ...(typeof watchSeconds === 'number' ? { watchSeconds } : {}) }),
    }).catch(() => undefined)

const ClipCard = ({ video }: ClipCardProps) => {
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const viewTracked = useRef(false)
    const completeTracked = useRef(false)
    const maxWatch = useRef(video.progress?.watchedSeconds || 0)

    const [playing, setPlaying] = useState(false)
    const [liked, setLiked] = useState(Boolean(video.liked))
    const [saved, setSaved] = useState(Boolean(video.saved))
    const [shared, setShared] = useState(false)
    const [showQuiz, setShowQuiz] = useState(false)

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

    const togglePlay = useCallback(() => {
        const element = videoRef.current
        if (!element) return
        if (element.paused) {
            void element.play()
            setPlaying(true)
        } else {
            element.pause()
            setPlaying(false)
        }
    }, [])

    const onLoadedData = () => {
        if (viewTracked.current) return
        viewTracked.current = true
        void trackEvent(video.videoId, 'view')
    }

    const onTimeUpdate = () => {
        const element = videoRef.current
        if (!element || !Number.isFinite(element.currentTime)) return
        maxWatch.current = Math.max(maxWatch.current, element.currentTime)
        const duration = element.duration || 0
        if (!completeTracked.current && duration > 0 && element.currentTime / duration >= 0.9) {
            completeTracked.current = true
            void trackEvent(video.videoId, 'complete', Math.floor(element.currentTime))
            if (video.quizDue) setShowQuiz(true)
        }
    }

    const toggleLike = () => {
        const nextLiked = !liked
        setLiked(nextLiked)
        void trackEvent(video.videoId, nextLiked ? 'like' : 'unlike')
    }

    const toggleSave = () => {
        const nextSaved = !saved
        setSaved(nextSaved)
        void trackEvent(video.videoId, nextSaved ? 'save' : 'unsave')
    }

    const share = async () => {
        const url = typeof window !== 'undefined' ? `${window.location.origin}/embed/${video.playbackId}` : ''
        try {
            if (navigator.share) await navigator.share({ title: video.title, url })
            else await navigator.clipboard.writeText(url)
            setShared(true)
            setTimeout(() => setShared(false), 1800)
        } catch {
            /* user cancelled */
        }
        void trackEvent(video.videoId, 'share')
    }

    return (
        <article
            style={{
                background: theme.color.surface,
                border: `1px solid ${video.featured ? theme.color.primary : theme.color.border}`,
                borderRadius: theme.radius.lg,
                overflow: 'hidden',
                marginBottom: 20,
            }}
        >
            <div style={{ position: 'relative', background: '#000' }}>
                <video
                    ref={videoRef}
                    style={{ width: '100%', aspectRatio: '9 / 16', maxHeight: '70vh', objectFit: 'contain', display: 'block' }}
                    loop
                    muted
                    playsInline
                    onLoadedData={onLoadedData}
                    onTimeUpdate={onTimeUpdate}
                    onClick={togglePlay}
                />
                {video.featured && (
                    <span style={badge(theme.color.primary)}>★ Featured</span>
                )}
                {!playing && (
                    <button
                        onClick={togglePlay}
                        aria-label="Play clip"
                        style={{
                            position: 'absolute',
                            inset: 0,
                            margin: 'auto',
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            border: 0,
                            background: 'rgba(0,0,0,0.55)',
                            color: '#fff',
                            fontSize: 24,
                            cursor: 'pointer',
                        }}
                    >
                        ▶
                    </button>
                )}
            </div>

            <div style={{ padding: 14 }}>
                <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>{video.title}</h2>
                {video.categories && video.categories.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                        {video.categories.slice(0, 5).map((category) => (
                            <span
                                key={category}
                                style={{
                                    fontSize: 11,
                                    padding: '3px 8px',
                                    borderRadius: theme.radius.pill,
                                    background: theme.color.surfaceRaised,
                                    color: theme.color.textMuted,
                                }}
                            >
                                {category}
                            </span>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={toggleLike} aria-pressed={liked} style={actionButton(liked, theme.color.danger)}>
                        {liked ? '♥' : '♡'} Like
                    </button>
                    <button onClick={toggleSave} aria-pressed={saved} style={actionButton(saved, theme.color.warning)}>
                        {saved ? '★' : '☆'} Save
                    </button>
                    <button onClick={share} style={actionButton(false, theme.color.accent)}>
                        ↗ {shared ? 'Copied' : 'Share'}
                    </button>
                </div>

                {showQuiz && (
                    <div style={{ marginTop: 14 }}>
                        <QuizCard assetId={video.videoId} onClose={() => setShowQuiz(false)} />
                    </div>
                )}
            </div>
        </article>
    )
}

const actionButton = (active: boolean, activeColor: string): React.CSSProperties => ({
    flex: 1,
    padding: '9px 10px',
    borderRadius: theme.radius.pill,
    border: `1px solid ${active ? activeColor : theme.color.border}`,
    background: active ? `${activeColor}22` : 'transparent',
    color: active ? activeColor : theme.color.textMuted,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
})

const badge = (color: string): React.CSSProperties => ({
    position: 'absolute',
    top: 10,
    left: 10,
    fontSize: 11,
    fontWeight: 700,
    padding: '4px 8px',
    borderRadius: theme.radius.pill,
    background: color,
    color: theme.color.onPrimary,
})

export default ClipCard
