import type { NextApiRequest, NextApiResponse } from 'next'
import { forwardHovodRequest } from '../../../lib/server/hovod'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET')
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const response = await forwardHovodRequest(req, '/v1/auth/me')
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
            return res.status(response.status).json({ error: (payload as { error?: string })?.error || 'Unauthorized' })
        }

        return res.status(200).json(payload)
    } catch (error) {
        return res.status(500).json({ error: (error as Error).message || 'Internal server error' })
    }
}

export default handler
