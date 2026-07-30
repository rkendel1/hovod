import React, { FC } from 'react'
import styles from './desktop_view.module.css'
import ApiVideoLogoWhite from '../../../public/logo-white.svg'
import TikTokLogo from '../../../public/tiktok-logo.svg'
import Image from 'next/image'

const DesktopView: FC = (): JSX.Element => {
    return (
        <div className={styles.desktop}>
            <div className={styles.desktop__wrapper}>
                <div className={styles.banner__wrapper}>
                    <div className={styles.banner}>
                        <p className={styles.banner__title}>Hovod Learn</p>
                        <p className={styles.banner__subtitle}>
                            Scan the QR code to get the mobile experience <span className={styles.orange}>*</span>
                        </p>
                        <div className={styles.qrcode__dark}>
                            <div className={styles.qrcode__white}>
                                <p className={styles.qrcode__title} style={{ color: '#111', margin: 0 }}>
                                    localhost:3004
                                </p>
                            </div>
                            <p className={styles.qrcode__title}>SCAN ME</p>
                        </div>
                        <div className={styles.banner__logo}>
                            <Image src={ApiVideoLogoWhite} alt="Hovod" />
                            <Image src={TikTokLogo} alt="Logo TikTok" />
                        </div>
                    </div>
                    <p className={styles.desktop__legend} style={{ width: ' 800px' }}>
                        <span className={styles.orange}>*</span> For the best experience, install this app on your phone.
                    </p>
                </div>

                <div className={styles.desktop__container}>
                    <video
                        className={styles.desktop__video}
                        muted
                        autoPlay
                        loop
                        src={'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'}
                    />
                    <p className={styles.desktop__legend} style={{ textAlign: 'center' }}>
                        Preview
                    </p>
                </div>
            </div>
            <footer className={styles.footer}>
                Made with 🧡 &nbsp;by
                <a href="https://github.com/rkendel1/hovod" target="_blank" rel="noreferrer" className={styles.orange}>
                    &nbsp;Hovod
                </a>
            </footer>
        </div>
    )
}

export default DesktopView
