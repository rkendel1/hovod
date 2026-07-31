import type { GetServerSideProps, NextPage } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import AppShell from '../components/shell/AppShell'
import ClipCard from '../components/clip/ClipCard'
import { theme } from '../lib/theme'
import { useSession } from '../lib/useSession'
import type { VideoItem } from '../types/video'
import { readSession } from '../lib/server/auth'
import { readUserPreferences } from '../lib/server/preferences'

interface FeedItem {
    id: string
    title: string
    playbackId: string
    playbackUrl: string | null
    categories?: string[]
    source?: string
    featured?: boolean
    quizDue?: boolean
    liked?: boolean
    saved?: boolean
    progress?: { watchedSeconds: number; completed: boolean }
}

interface FeedResponse {
    data?: { items?: FeedItem[]; nextCursor?: string | null }
    error?: string
}

const toVideoItem = (item: FeedItem): VideoItem => ({
    videoId: item.id,
    playbackId: item.playbackId,
    title: item.title,
    status: 'ready',
    metadata: [],
    manifestUrl: item.playbackUrl,
    categories: item.categories || [],
    source: item.source,
    featured: Boolean(item.featured),
    quizDue: Boolean(item.quizDue),
    liked: Boolean(item.liked),
    saved: Boolean(item.saved),
    progress: item.progress,
})

const Landing = () => (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '64px 20px', color: theme.color.text }}>
        <Head>
            <title>Hovod Learn</title>
        </Head>
        <p style={{ color: theme.color.accent, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', fontSize: 12 }}>
            Personal learning stream
        </p>
        <h1 style={{ margin: '8px 0 16px', fontSize: 40, lineHeight: 1.1 }}>
            Learn in short clips.<br />Remember with quizzes.
        </h1>
        <p style={{ color: theme.color.textMuted, marginBottom: 28, fontSize: 16, maxWidth: 520 }}>
            Pick your topics and a quiz cadence, then get a continuous, personalized stream of vertical
            lessons — with retention checks that fire on your schedule.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/signup" style={cta(theme.color.primary, theme.color.onPrimary)}>
                Get started
            </Link>
            <Link href="/login" style={cta('transparent', theme.color.text, theme.color.border)}>
                Log in
            </Link>
        </div>
    </main>
)

const cta = (bg: string, color: string, border?: string): React.CSSProperties => ({
    padding: '12px 22px',
    borderRadius: theme.radius.pill,
    background: bg,
    color,
    fontWeight: 600,
    border: border ? `1px solid ${border}` : '0',
})

const Home: NextPage = () => {
    const { loading: sessionLoading, user } = useSession()
    const [videos, setVideos] = useState<VideoItem[]>([])
    const [cursor, setCursor] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const loadingRef = useRef(false)

    const loadFeed = useCallback(async (nextCursor: string | null, reset: boolean) => {
        if (loadingRef.current) return
        loadingRef.current = true
        setLoading(true)
        try {
            const query = new URLSearchParams({ limit: '10' })
            if (nextCursor) query.set('cursor', nextCursor)
            const response = await fetch(`/api/feed?${query.toString()}`)
            const payload = (await response.json().catch(() => ({}))) as FeedResponse
            if (!response.ok) return
            const items = (payload?.data?.items || []).map(toVideoItem)
            setVideos((prev) => (reset ? items : [...prev, ...items]))
            setCursor(payload?.data?.nextCursor || null)
        } finally {
            loadingRef.current = false
            setLoading(false)
            setLoaded(true)
        }
    }, [])

    useEffect(() => {
        if (user) void loadFeed(null, true)
    }, [user, loadFeed])

    if (sessionLoading) {
        return <main style={{ color: theme.color.text, padding: 24 }}>Loading…</main>
    }

    if (!user) return <Landing />

    return (
        <AppShell title="Home · Hovod Learn" user={user} variant="consumer" maxWidth={520}>
            {loaded && videos.length === 0 && (
                <div
                    style={{
                        textAlign: 'center',
                        padding: '48px 16px',
                        color: theme.color.textMuted,
                        border: `1px dashed ${theme.color.border}`,
                        borderRadius: theme.radius.lg,
                    }}
                >
                    <p style={{ margin: '0 0 8px', fontWeight: 600, color: theme.color.text }}>Your stream is warming up</p>
                    <p style={{ margin: 0, fontSize: 14 }}>
                        No published clips match your topics yet. Try broadening your{' '}
                        <Link href="/settings" style={{ color: theme.color.primary }}>categories</Link>.
                    </p>
                </div>
            )}

            {videos.map((video) => (
                <ClipCard key={video.videoId} video={video} />
            ))}

            {cursor && (
                <button
                    onClick={() => void loadFeed(cursor, false)}
                    disabled={loading}
                    style={{
                        display: 'block',
                        margin: '8px auto 32px',
                        padding: '10px 20px',
                        borderRadius: theme.radius.pill,
                        border: `1px solid ${theme.color.border}`,
                        background: theme.color.surface,
                        color: theme.color.text,
                        cursor: 'pointer',
                    }}
                >
                    {loading ? 'Loading…' : 'Load more'}
                </button>
            )}
        </AppShell>
    )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const session = await readSession(context)
    if (!session) return { props: {} }

    const preferences = await readUserPreferences(context)
    if (!preferences?.onboardingCompletedAt) {
        return { redirect: { destination: '/onboarding', permanent: false } }
    }
    return { props: {} }
}

export default Home
