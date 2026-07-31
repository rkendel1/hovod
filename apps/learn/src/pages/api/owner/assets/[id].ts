import type { NextApiRequest, NextApiResponse } from 'next'
import { forwardHovodRequest } from '../../../../lib/server/hovod'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    const id = String(req.query.id || '')
    if (!id) return res.status(400).json({ error: 'id is required' })

    if (req.method !== 'PATCH') {
        res.setHeader('Allow', 'PATCH')
        return res.status(405).json({ error: 'Method not allowed' })
    }
    try {
        const response = await forwardHovodRequest(req, `/v1/owner/assets/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(req.body || {}),
        })
        const payload = await response.json().catch(() => ({}))
        return res.status(response.status).json(payload)
    } catch (error) {
        return res.status(500).json({ error: (error as Error).message || 'Internal server error' })
    }
}

export default handler
