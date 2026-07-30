import type { NextApiRequest, NextApiResponse } from 'next'
import { getOpenReelsApiUrl } from '../../../lib/server/openreels'

const handler = async (_req: NextApiRequest, res: NextApiResponse) => {
    const baseUrl = getOpenReelsApiUrl()

    const probe = async (pathname: string) => {
        try {
            const response = await fetch(`${baseUrl}${pathname}`)
            return response.ok
        } catch {
            return false
        }
    }

    const ok = (await probe('/health')) || (await probe('/api/v1/jobs'))

    if (!ok) {
        return res.status(503).json({ data: { ok: false } })
    }

    return res.status(200).json({ data: { ok: true } })
}

export default handler
