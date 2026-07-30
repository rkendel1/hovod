import { NextApiRequest, NextApiResponse } from 'next'
import type { VideoItem, VideoMetadata } from '@hovod/contracts'
import { deriveAssetTitle } from '@hovod/contracts'
import { forwardHovodRequest, getHovodBaseUrl } from '../../../lib/server/hovod'

interface HovodAsset {
    id: string
    playbackId: string
    title: string
    status: string
    customMetadata?: Record<string, string> | null
}

const metadataObjectToArray = (metadata: Record<string, string> | null | undefined): VideoMetadata[] =>
    Object.entries(metadata || {}).map(([key, value]) => ({ key, value }))

const metadataArrayToObject = (metadata: VideoMetadata[]): Record<string, string> =>
    metadata.reduce<Record<string, string>>((acc, item) => {
        if (item?.key) acc[item.key] = item.value || ''
        return acc
    }, {})

const getManifestUrl = async (baseUrl: string, playbackId: string): Promise<string | null> => {
    try {
        const response = await fetch(`${baseUrl}/v1/playback/${playbackId}`)
        if (!response.ok) return null
        const payload = await response.json()
        return payload?.data?.manifestUrl || null
    } catch {
        return null
    }
}

const mapAsset = async (baseUrl: string, asset: HovodAsset): Promise<VideoItem> => ({
    videoId: asset.id,
    playbackId: asset.playbackId,
    title: asset.title,
    status: asset.status,
    metadata: metadataObjectToArray(asset.customMetadata),
    manifestUrl: asset.status === 'ready' ? await getManifestUrl(baseUrl, asset.playbackId) : null,
})

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    const baseUrl = getHovodBaseUrl()

    try {
        const method = String(req.query.method || '').toLowerCase()

        if (method === 'patch') {
            const { videoId, metadata } = req.body as { videoId?: string; metadata?: VideoMetadata[] }
            if (!videoId || !Array.isArray(metadata)) {
                return res.status(400).json({ error: 'videoId and metadata are required' })
            }

            const response = await forwardHovodRequest(req, `/v1/assets/${videoId}`, {
                method: 'PATCH',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({ metadata: metadataArrayToObject(metadata) }),
            })

            if (!response.ok) {
                const text = await response.text()
                return res.status(response.status).json({ error: text || 'Failed to update metadata' })
            }

            return res.status(204).end()
        }

        if (method === 'create') {
            const { title } = req.body as { title?: string }
            if (!title) return res.status(400).json({ error: 'title is required' })

            const response = await forwardHovodRequest(req, '/v1/assets', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({ title: deriveAssetTitle(title) }),
            })

            const payload = await response.json()
            if (!response.ok) {
                return res.status(response.status).json({ error: payload?.error || 'Failed to create asset' })
            }

            return res.status(201).json({ data: { videoId: payload?.data?.id } })
        }

        if (method === 'upload-url') {
            const { videoId } = req.body as { videoId?: string }
            if (!videoId) return res.status(400).json({ error: 'videoId is required' })

            const response = await forwardHovodRequest(req, `/v1/assets/${videoId}/upload-url`, {
                method: 'POST',
            })

            const payload = await response.json()
            if (!response.ok) {
                return res.status(response.status).json({ error: payload?.error || 'Failed to get upload URL' })
            }

            return res.status(200).json({ data: payload.data })
        }

        if (method === 'upload-complete') {
            const { videoId } = req.body as { videoId?: string }
            if (!videoId) return res.status(400).json({ error: 'videoId is required' })

            const response = await forwardHovodRequest(req, `/v1/assets/${videoId}/upload-complete`, {
                method: 'POST',
            })

            const payload = await response.json()
            if (!response.ok) {
                return res.status(response.status).json({ error: payload?.error || 'Failed to confirm upload' })
            }

            return res.status(200).json({ data: payload.data })
        }

        if (method === 'process') {
            const { videoId } = req.body as { videoId?: string }
            if (!videoId) return res.status(400).json({ error: 'videoId is required' })

            const response = await forwardHovodRequest(req, `/v1/assets/${videoId}/process`, {
                method: 'POST',
            })

            const payload = await response.json()
            if (!response.ok) {
                return res.status(response.status).json({ error: payload?.error || 'Failed to process asset' })
            }

            return res.status(200).json({ data: payload.data })
        }

        const response = await forwardHovodRequest(req, '/v1/assets')

        const payload = await response.json()
        if (!response.ok) {
            return res.status(response.status).json({ error: payload?.error || 'Failed to list videos' })
        }

        const assets: HovodAsset[] = Array.isArray(payload?.data) ? payload.data : []
        const data = await Promise.all(assets.map((asset) => mapAsset(baseUrl, asset)))

        return res.status(200).json({ data })
    } catch (error) {
        return res.status(500).json({ error: (error as Error).message || 'Internal server error' })
    }
}

export default handler
