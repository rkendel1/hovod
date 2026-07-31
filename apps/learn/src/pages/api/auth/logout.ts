import type { NextApiRequest, NextApiResponse } from 'next'
import { clearTokenCookie } from '../../../lib/server/session'

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST')
        return res.status(405).json({ error: 'Method not allowed' })
    }

    clearTokenCookie(res)
    return res.status(200).json({ data: { ok: true } })
}

export default handler
