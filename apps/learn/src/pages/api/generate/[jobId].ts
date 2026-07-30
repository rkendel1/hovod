import type { NextApiRequest, NextApiResponse } from 'next'
import { forwardHovodRequest } from '../../../lib/server/hovod'
import { normalizeOpenReelsJob, openReelsJson } from '../../../lib/server/openreels'

interface HovodAsset {
    id: string
    customMetadata?: Record<string, string> | null
}

const readPublisherMapping = async (jobId: string): Promise<string | null> => {
    const baseUrl = (process.env.OPENREELS_PUBLISHER_URL || 'http://openreels-hovod-publisher:3201').replace(/\/$/, '')

    try {
        const response = await fetch(`${baseUrl}/mappings/${encodeURIComponent(jobId)}`)
        if (!response.ok) return null
        const payload = await response.json().catch(() => ({}))

        const mapping = (payload as { data?: { hovodAssetId?: string } })?.data
        return typeof mapping?.hovodAssetId === 'string' && mapping.hovodAssetId ? mapping.hovodAssetId : null
    } catch {
        return null
    }
}

const readHovodAssetId = async (req: NextApiRequest, jobId: string): Promise<string | null> => {
    const response = await forwardHovodRequest(req, '/v1/assets')
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) return null

    const assets: HovodAsset[] = Array.isArray((payload as { data?: HovodAsset[] })?.data)
        ? (payload as { data: HovodAsset[] }).data
        : []

    const match = assets.find((asset) => asset?.customMetadata?.openreelsJobId === jobId)
    return match?.id || null
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET')
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : ''
    if (!jobId) return res.status(400).json({ error: 'jobId is required' })

    try {
        const payload = await openReelsJson(`/api/v1/jobs/${encodeURIComponent(jobId)}`)
        const job = normalizeOpenReelsJob(payload)

        let hovodAssetId: string | null = null
        const status = job.status.toLowerCase()

        if (status === 'completed' || status === 'done' || status === 'success') {
            hovodAssetId = await readPublisherMapping(jobId)

            if (!hovodAssetId) {
                hovodAssetId = await readHovodAssetId(req, jobId)
            }
        }

        return res.status(200).json({
            jobId: job.id,
            status: job.status,
            progress: job.progress,
            stage: job.stage,
            topic: job.topic,
            outputPath: job.outputPath,
            hovodAssetId,
            error: job.error,
        })
    } catch (error) {
        return res.status(502).json({ error: (error as Error).message || 'Failed to fetch OpenReels job status' })
    }
}

export default handler
