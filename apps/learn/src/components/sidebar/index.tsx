import { MdFavorite, MdOutlineBookmark } from 'react-icons/md'
import { RiShareForwardFill } from 'react-icons/ri'
import styles from './sidebar.module.css'
import Image from 'next/image'
import ApiVideoLogo from '../../../public/logo-white.svg'
import { FC, useEffect, useState } from 'react'
import { onShare } from '../../utils/share'
import 'animate.css'
import { getSocialResults } from '../../utils/socialResults'
import type { VideoItem, VideoMetadata } from '../../types/video'

export interface ISidebarProps {
    video: VideoItem
    mutate: () => void
}

const Sidebar: FC<ISidebarProps> = ({ video, mutate }): JSX.Element => {
    const [likes, setLikes] = useState(0)
    const [bookmarks, setBookmarks] = useState(0)

    const [clickedLikes, setClickedLikes] = useState(false)
    const [clickedBookmarks, setClickedBookmarks] = useState(false)

    const { videoId } = video

    useEffect(() => {
        if (video) {
            setLikes(getSocialResults(video, 'likes'))
            setBookmarks(getSocialResults(video, 'bookmarks'))
        }
    }, [video])

    const updateVideos = async (metadata: Array<VideoMetadata>) => {
        await fetch(`/api/videos?method=patch`, {
            method: 'Post',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId, metadata }),
        })
    }

    const onPressItem = async (metadata: Array<VideoMetadata>, icon: string) => {
        if (icon === 'MdFavorite') setClickedLikes(true)
        if (icon === 'MdOutlineBookmark') setClickedBookmarks(true)

        await updateVideos(metadata)

        mutate()
    }

    return (
        <div className={styles.sidebar}>
            <a href="https://github.com/rkendel1/hovod" target={'_blank'} rel="noreferrer">
                <Image src={ApiVideoLogo} width={40} height={40} alt="Hovod" />
            </a>
            <div
                className={styles.sidebar__button}
                onClick={() =>
                    !clickedLikes &&
                    onPressItem(
                        [
                            { key: 'likes', value: `${likes + 1}` },
                            { key: 'bookmarks', value: `${bookmarks}` },
                        ],
                        'MdFavorite'
                    )
                }
            >
                <div className={clickedLikes ? 'animate__animated animate__heartBeat' : ''}>
                    <MdFavorite size={40} color={clickedLikes ? '#D65076' : '#fff'} />
                </div>
                <p>{likes}</p>
            </div>
            <div
                className={styles.sidebar__button}
                onClick={() =>
                    !clickedBookmarks &&
                    onPressItem(
                        [
                            { key: 'likes', value: `${likes}` },
                            { key: 'bookmarks', value: `${bookmarks + 1}` },
                        ],
                        'MdOutlineBookmark'
                    )
                }
            >
                <div className={clickedBookmarks ? 'animate__animated animate__heartBeat' : ''}>
                    <MdOutlineBookmark size={40} color={clickedBookmarks ? '#FCD354' : '#FFFFFF'} />
                </div>
                <p>{bookmarks}</p>
            </div>
            <div className={styles.sidebar__button} onClick={onShare}>
                <RiShareForwardFill size={40} />
            </div>
        </div>
    )
}

export default Sidebar
