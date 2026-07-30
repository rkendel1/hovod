import type { NextApiRequest, NextApiResponse } from 'next'
import { normalizeOpenReelsJob, openReelsJson } from '../../../lib/server/openreels'

interface GenerateBody {
    topic?: string
    provider?: string
    archetype?: string
    direction?: string
    ttsProvider?: string
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST')
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}) as GenerateBody
        const topic = body.topic?.trim()

        if (!topic) {
            return res.status(400).json({ error: 'topic is required' })
        }

        const provider = body.provider?.trim() || process.env.OPENREELS_DEFAULT_PROVIDER || 'google'

        const payload = await openReelsJson('/api/v1/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic,
                provider,
                ...(body.archetype ? { archetype: body.archetype } : {}),
                ...(body.direction ? { direction: body.direction } : {}),
                ...(body.ttsProvider ? { ttsProvider: body.ttsProvider } : {}),
            }),
        })

        const job = normalizeOpenReelsJob(payload)

        return res.status(201).json({ jobId: job.id })
    } catch (error) {
        return res.status(502).json({ error: (error as Error).message || 'Failed to start OpenReels job' })
    }
}

export default handler
