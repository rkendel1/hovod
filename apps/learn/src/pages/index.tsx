import type { NextPage } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { DASHBOARD_PATHS } from '@hovod/contracts'
import DesktopView from '../components/desktopView'
import GenerateShort from '../components/generateShort'
import Upload from '../components/upload'
import VideoComponent from '../components/video/index'
import styles from './index.module.css'
import type { VideoItem } from '../types/video'

interface VideosResponse {
    data: VideoItem[]
}

const Home: NextPage = () => {
    const [videos, setVideos] = useState<VideoItem[]>([])
    const { data, mutate } = useSWR<VideosResponse>('api/videos?method=get')
    const dashboardBaseUrl = (process.env.NEXT_PUBLIC_HOVOD_DASHBOARD_URL || 'http://localhost:3003').replace(/\/$/, '')

    useEffect(() => {
        if (data?.data) {
            setVideos([...data.data].reverse())
        }

        const sections = document.getElementById('videos__container')
        sections?.scrollIntoView(true)
    }, [data])

    return (
        <div className={styles.app} id="videos__container">
            <Head>
                <title>Hovod Learn</title>
                <meta name="description" content="TikTok-style learn app powered by Hovod" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <div className={styles.app__large_screen}>
                <DesktopView />
            </div>

            <GenerateShort onPublished={() => void mutate()} />

            <div className={styles.app__videos}>
                {videos.map((video) => {
                    return <VideoComponent key={video.videoId} video={video} mutate={mutate} />
                })}
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
            </div>

            <Upload mutate={mutate} />
        </div>
    )
}

export default Home
