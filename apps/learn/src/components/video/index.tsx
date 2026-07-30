import React, { FC, useEffect, useRef, useState } from 'react'
import Footer from '../footer'
import Sidebar from '../sidebar'
import styles from './videos.module.css'
import Hls from 'hls.js'
import type { VideoItem } from '../../types/video'

export interface IvideosProps {
    video: VideoItem
    mutate: () => void
}

const VideoComponent: FC<IvideosProps> = ({ video, mutate }): JSX.Element => {
    const [playing, setPlaying] = useState<boolean>(true)
    const videoRef = useRef<HTMLVideoElement | null>(null)

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

    const onVideoPress = () => {
        if (playing) {
            videoRef.current?.pause()
            setPlaying(false)
            return
        }

        videoRef.current?.play()
        setPlaying(true)
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
                    />
                    <div onClick={onVideoPress} className={styles.video__press}></div>

                    <Footer video={video} />
                    <Sidebar video={video} mutate={mutate} />
                </div>
            )}
        </>
    )
}

export default VideoComponent
