import type { NextApiRequest, NextApiResponse } from 'next'
import { forwardHovodRequest } from '../../../../lib/server/hovod'

/** Persists onboarding completion by marking the preferences record complete. */
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST')
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const body = (req.body || {}) as Record<string, unknown>
        const response = await forwardHovodRequest(req, '/v1/learn/preferences', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...body, onboardingCompleted: true }),
        })
        const payload = await response.json().catch(() => ({}))
        return res.status(response.status).json(payload)
    } catch (error) {
        return res.status(500).json({ error: (error as Error).message || 'Internal server error' })
    }
}

export default handler
