import type { NextApiRequest, NextApiResponse } from 'next'
import { forwardHovodRequest } from '../../../lib/server/hovod'

export const config = {
    api: {
        bodyParser: false,
    },
}

const readRawBody = async (req: NextApiRequest): Promise<Buffer> => {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    }
    return Buffer.concat(chunks)
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        if (req.method === 'PUT') {
            const buffer = await readRawBody(req)
            const contentType = req.headers['content-type'] || 'image/png'
            const response = await forwardHovodRequest(req, '/v1/settings/logo', {
                method: 'PUT',
                headers: {
                    'content-type': Array.isArray(contentType) ? contentType[0] : contentType,
                },
                body: buffer,
            })
            const payload = await response.json()
            if (!response.ok) return res.status(response.status).json({ error: payload?.error || 'Failed to upload logo' })
            return res.status(200).json({ data: payload.data })
        }

        if (req.method === 'DELETE') {
            const response = await forwardHovodRequest(req, '/v1/settings/logo', { method: 'DELETE' })
            const payload = await response.json()
            if (!response.ok) return res.status(response.status).json({ error: payload?.error || 'Failed to remove logo' })
            return res.status(200).json({ data: payload.data })
        }

        return res.status(405).json({ error: 'Method not allowed' })
    } catch (error) {
        return res.status(500).json({ error: (error as Error).message || 'Internal server error' })
    }
}

export default handler
