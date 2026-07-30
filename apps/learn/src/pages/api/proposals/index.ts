import type { NextApiRequest, NextApiResponse } from 'next'
import { forwardHovodRequest } from '../../../lib/server/hovod'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        if (req.method === 'GET') {
            const query = new URLSearchParams()
            if (typeof req.query.status === 'string') query.set('status', req.query.status)
            if (typeof req.query.category === 'string') query.set('category', req.query.category)
            if (typeof req.query.limit === 'string') query.set('limit', req.query.limit)
            const suffix = query.toString() ? `?${query.toString()}` : ''
            const response = await forwardHovodRequest(req, `/v1/proposals${suffix}`)
            const payload = await response.json().catch(() => ({}))
            return res.status(response.status).json(payload)
        }

        if (req.method === 'POST') {
            const response = await forwardHovodRequest(req, '/v1/proposals/discover', { method: 'POST' })
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
