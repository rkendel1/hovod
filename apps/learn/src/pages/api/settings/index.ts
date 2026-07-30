import type { NextApiRequest, NextApiResponse } from 'next'
import { DEFAULT_PLATFORM_SETTINGS, VALID_SETTINGS_THEMES, normalizeHexColor } from '@hovod/contracts'
import type { PlatformSettings } from '@hovod/contracts'
import { forwardHovodRequest } from '../../../lib/server/hovod'

const coerceSettingsPayload = (input: unknown): Partial<PlatformSettings> => {
    if (!input || typeof input !== 'object') return {}
    const payload = input as Partial<PlatformSettings>
    const updates: Partial<PlatformSettings> = {}

    if (typeof payload.primaryColor === 'string') {
        updates.primaryColor = normalizeHexColor(payload.primaryColor, DEFAULT_PLATFORM_SETTINGS.primaryColor)
    }
    if (VALID_SETTINGS_THEMES.includes(payload.theme as 'light' | 'dark')) {
        updates.theme = payload.theme
    }
    if (typeof payload.aiAutoTranscribe === 'boolean') {
        updates.aiAutoTranscribe = payload.aiAutoTranscribe
    }
    if (typeof payload.aiAutoChapter === 'boolean') {
        updates.aiAutoChapter = payload.aiAutoChapter
    }

    return updates
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    try {
        if (req.method === 'GET') {
            const response = await forwardHovodRequest(req, '/v1/settings')
            const payload = await response.json()
            if (!response.ok) return res.status(response.status).json({ error: payload?.error || 'Failed to fetch settings' })
            return res.status(200).json({ data: payload.data })
        }

        if (req.method === 'PATCH') {
            const updates = coerceSettingsPayload(req.body)
            const response = await forwardHovodRequest(req, '/v1/settings', {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(updates),
            })
            const payload = await response.json()
            if (!response.ok) return res.status(response.status).json({ error: payload?.error || 'Failed to update settings' })
            return res.status(200).json({ data: payload.data })
        }

        return res.status(405).json({ error: 'Method not allowed' })
    } catch (error) {
        return res.status(500).json({ error: (error as Error).message || 'Internal server error' })
    }
}

export default handler
