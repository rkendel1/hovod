import type { NextApiRequest, NextApiResponse } from 'next'
import { forwardHovodRequest } from '../../../lib/server/hovod'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    const assetId = String(req.query.assetId || '')
    if (!assetId) return res.status(400).json({ error: 'assetId is required' })

    try {
        if (req.method === 'GET') {
            const response = await forwardHovodRequest(req, `/v1/learn/quizzes/${encodeURIComponent(assetId)}`)
            const payload = await response.json().catch(() => ({}))
            return res.status(response.status).json(payload)
        }

        if (req.method === 'POST') {
            const response = await forwardHovodRequest(req, `/v1/learn/quizzes/${encodeURIComponent(assetId)}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(req.body || {}),
            })
            const payload = await response.json().catch(() => ({}))
            return res.status(response.status).json(payload)
        }

        res.setHeader('Allow', 'GET, POST')
        return res.status(405).json({ error: 'Method not allowed' })
    } catch (error) {
        return res.status(500).json({ error: (error as Error).message || 'Internal server error' })
    }
}

export default handler
