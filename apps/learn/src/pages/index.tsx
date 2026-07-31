import type { GetServerSideProps, NextPage } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DASHBOARD_PATHS } from '@hovod/contracts'
import DesktopView from '../components/desktopView'
import GenerateShort from '../components/generateShort'
import Upload from '../components/upload'
import VideoComponent from '../components/video/index'
import styles from './index.module.css'
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
    quizDue?: boolean
    progress?: {
        watchedSeconds: number
        completed: boolean
    }
}

interface FeedResponse {
    data?: {
        items?: FeedItem[]
        nextCursor?: string | null
    }
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
    quizDue: Boolean(item.quizDue),
    progress: item.progress,
})

const Home: NextPage = () => {
    const dashboardBaseUrl = (process.env.NEXT_PUBLIC_HOVOD_DASHBOARD_URL || 'http://localhost:3003').replace(/\/$/, '')
    const [authenticated, setAuthenticated] = useState<boolean | null>(null)
    const [videos, setVideos] = useState<VideoItem[]>([])
    const [cursor, setCursor] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const loadingRef = useRef(false)

    const loadFeed = useCallback(async (nextCursor: string | null, reset: boolean) => {
        if (!authenticated) return
        if (loadingRef.current) return

        loadingRef.current = true
        setLoading(true)
        try {
            const query = new URLSearchParams({ limit: '20' })
            if (nextCursor) query.set('cursor', nextCursor)
            const response = await fetch(`/api/feed?${query.toString()}`)
            const payload = (await response.json().catch(() => ({}))) as FeedResponse

            if (!response.ok) {
                setLoading(false)
                return
            }

            const items = (payload?.data?.items || []).map(toVideoItem)
            const next = payload?.data?.nextCursor || null

            setVideos((prev) => (reset ? items : [...prev, ...items]))
            setCursor(next)
            setHasMore(Boolean(next))
        } finally {
            loadingRef.current = false
            setLoading(false)
        }
    }, [authenticated])

    const refreshFeed = useCallback(() => {
        setCursor(null)
        setHasMore(true)
        void loadFeed(null, true)
    }, [loadFeed])

    useEffect(() => {
        fetch('/api/auth/me')
            .then((response) => {
                setAuthenticated(response.ok)
            })
            .catch(() => setAuthenticated(false))
    }, [])

    useEffect(() => {
        if (authenticated !== true) return
        if (authenticated) {
            void loadFeed(null, true)
        }
    }, [authenticated, loadFeed])

    const onLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/'
    }

    const landing = useMemo(() => (
        <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px', color: '#fff' }}>
            <h1 style={{ marginTop: 0, fontSize: 34 }}>Hovod Learn</h1>
            <p style={{ color: '#a1a1aa', marginBottom: 20 }}>
                Personalized short-form learning stream with onboarding and retention quizzes.
            </p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <Link href="/login" style={{ color: '#fff', background: '#27272a', borderRadius: 999, padding: '10px 14px' }}>
                    Log in
                </Link>
                <Link href="/signup" style={{ color: '#fff', background: '#4f46e5', borderRadius: 999, padding: '10px 14px' }}>
                    Sign up
                </Link>
            </div>
            <p style={{ color: '#71717a' }}>Sign in to get your own category-ranked feed and quiz cadence.</p>
        </main>
    ), [])

    if (authenticated === null) {
        return <main style={{ color: '#fff', padding: 24 }}>Loading...</main>
    }

    if (!authenticated) {
        return (
            <>
                <Head>
                    <title>Hovod Learn</title>
                </Head>
                {landing}
            </>
        )
    }

    return (
        <div className={styles.app} id="videos__container">
            <Head>
                <title>Hovod Learn</title>
                <meta name="description" content="Personalized TikTok-style learn app powered by Hovod" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <div className={styles.app__large_screen}>
                <DesktopView />
            </div>

            <GenerateShort onPublished={refreshFeed} />

            <div className={styles.app__videos}>
                {videos.map((video) => (
                    <VideoComponent key={video.videoId} video={video} mutate={refreshFeed} />
                ))}
            </div>

            <div className={styles.dashboard__links}>
                <Link href="#generate-short" className={styles.dashboard__link}>
                    Generate
                </Link>
                <Link href="/upload" className={styles.dashboard__link}>
                    Upload
                </Link>
                <Link href="/settings" className={styles.dashboard__link}>
                    Settings
                </Link>
                <Link href="/settings/preferences" className={styles.dashboard__link}>
                    Preferences
                </Link>
                <Link href="/proposals" className={styles.dashboard__link}>
                    Proposals
                </Link>
                <a
                    href={`${dashboardBaseUrl}${DASHBOARD_PATHS.analytics}`}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.dashboard__link}
                >
                    Analytics
                </a>
                <button onClick={onLogout} className={styles.dashboard__link} style={{ border: 0, background: 'transparent' }}>
                    Log out
                </button>
            </div>

            {hasMore && (
                <button
                    style={{ margin: '12px auto 24px', display: 'block', padding: '10px 16px', borderRadius: 999 }}
                    onClick={() => void loadFeed(cursor, false)}
                    disabled={loading || !cursor}
                >
                    {loading ? 'Loading...' : 'Load more'}
                </button>
            )}

            <Upload mutate={refreshFeed} />
        </div>
    )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const session = await readSession(context)
    if (!session) {
        return { props: {} }
    }

    const preferences = await readUserPreferences(context)
    if (!preferences?.onboardingCompletedAt) {
        return {
            redirect: {
                destination: '/onboarding',
                permanent: false,
            },
        }
    }

    return { props: {} }
}

export default Home
