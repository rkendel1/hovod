import type { NextPage } from 'next'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import DesktopView from '../components/desktopView'
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

            <div className={styles.app__videos}>
                {videos.map((video) => {
                    return <VideoComponent key={video.videoId} video={video} mutate={mutate} />
                })}
            </div>

            <Upload mutate={mutate} />
        </div>
    )
}

export default Home
