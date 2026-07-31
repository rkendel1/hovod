import type { NextApiRequest, NextApiResponse } from 'next'
import { getHovodBaseUrl } from '../../../lib/server/hovod'
import { setTokenCookie } from '../../../lib/server/session'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST')
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const response = await fetch(`${getHovodBaseUrl()}/v1/auth/signup`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(req.body || {}),
        })
        const payload = await response.json().catch(() => ({})) as { error?: string; data?: { token?: string; user?: unknown } }

        if (!response.ok || !payload?.data?.token) {
            return res.status(response.status || 400).json({ error: payload?.error || 'Signup failed' })
        }

        setTokenCookie(res, payload.data.token)
        return res.status(201).json({ data: { user: payload.data.user || null } })
    } catch (error) {
        return res.status(500).json({ error: (error as Error).message || 'Internal server error' })
    }
}

export default handler
