import styles from './footer.module.css'
import { RiMusic2Fill } from 'react-icons/ri'
import Marquee from 'react-fast-marquee'
import { FC } from 'react'
import type { VideoItem } from '../../types/video'

export interface ISidebarProps {
    video: VideoItem
}

const Footer: FC<ISidebarProps> = ({ video }): JSX.Element => {
    return (
        <div className={styles.videoFooter}>
            <div className={styles.videoFooter__text}>
                <h3>
                    <span>@</span>hovod
                </h3>
                <p>{video.title}</p>

                <div className={styles.videoFooter__marquee}>
                    <RiMusic2Fill size={16} color={'#e9e9e9'} />
                    <Marquee gradient={false} pauseOnHover={true} speed={40} style={{ maxWidth: '40%', marginLeft: '10px' }}>
                        <p>Open-source video platform for creators</p>
                    </Marquee>
                </div>
            </div>
        </div>
    )
}

export default Footer
