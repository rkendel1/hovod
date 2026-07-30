import type { VideoItem } from '../types/video'

export const getSocialResults = (video: VideoItem, key: string) => {
    const randomSocialResult = Math.floor(Math.random() * 1000)
    const currentSocialResult = video?.metadata && video?.metadata.filter((item) => item.key === key)
    const filterSocialResult = currentSocialResult && currentSocialResult[0]?.value

    return filterSocialResult ? +filterSocialResult : randomSocialResult
}
