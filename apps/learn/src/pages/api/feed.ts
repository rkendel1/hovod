import type { NextApiRequest, NextApiResponse } from 'next'
import { forwardHovodRequest } from '../../lib/server/hovod'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET')
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const query = new URLSearchParams()
        if (typeof req.query.cursor === 'string') query.set('cursor', req.query.cursor)
        if (typeof req.query.limit === 'string') query.set('limit', req.query.limit)
        const suffix = query.toString() ? `?${query.toString()}` : ''

        const response = await forwardHovodRequest(req, `/v1/learn/feed${suffix}`)
        const payload = await response.json().catch(() => ({}))
        return res.status(response.status).json(payload)
    } catch (error) {
        return res.status(500).json({ error: (error as Error).message || 'Internal server error' })
    }
}

export default handler
