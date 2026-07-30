import type { NextApiRequest, NextApiResponse } from 'next'
import { forwardHovodRequest, getHovodBaseUrl } from '../../../lib/server/hovod'

const getVideoStatus = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        const { videoId } = req.query
        const baseUrl = getHovodBaseUrl()

        const response = await forwardHovodRequest(req, `/v1/assets/${videoId as string}`)

        const payload = await response.json()
        if (!response.ok) {
            return res.status(response.status).json({ error: payload?.error || 'Failed to fetch asset status' })
        }

        let manifestUrl: string | null = null
        const playbackId = payload?.data?.playbackId as string | undefined
        if (payload?.data?.status === 'ready' && playbackId) {
            const playbackResponse = await fetch(`${baseUrl}/v1/playback/${playbackId}`)
            if (playbackResponse.ok) {
                const playbackPayload = await playbackResponse.json()
                manifestUrl = playbackPayload?.data?.manifestUrl || null
            }
        }

        return res.status(200).json({
            videoId: payload?.data?.id,
            playbackId: playbackId || null,
            status: payload?.data?.status,
            manifestUrl,
        })
    } catch {
        return res.status(400).json({ error: 'Failed to fetch status' })
    }
}

export default getVideoStatus
