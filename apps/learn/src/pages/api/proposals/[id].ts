import type { NextApiRequest, NextApiResponse } from 'next'
import { forwardHovodRequest } from '../../../lib/server/hovod'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET')
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const id = typeof req.query.id === 'string' ? req.query.id : ''
    if (!id) return res.status(400).json({ error: 'id is required' })

    try {
        const response = await forwardHovodRequest(req, `/v1/proposals/${encodeURIComponent(id)}`)
        const payload = await response.json().catch(() => ({}))
        return res.status(response.status).json(payload)
    } catch (error) {
        return res.status(500).json({ error: (error as Error).message || 'Internal server error' })
    }
}

export default handler
