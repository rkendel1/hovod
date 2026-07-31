import type { GetServerSidePropsContext } from 'next'
import { getHovodBaseUrl } from './hovod'
import { getTokenFromRequest, type SessionInfo } from './session'

export const readSession = async (context: GetServerSidePropsContext): Promise<SessionInfo | null> => {
    const token = getTokenFromRequest(context.req)
    if (!token) return null

    try {
        const response = await fetch(`${getHovodBaseUrl()}/v1/auth/me`, {
            headers: { authorization: 'Bearer '.concat(token) },
        })
        if (!response.ok) return null
        const payload = await response.json().catch(() => ({})) as { data?: SessionInfo }
        return payload?.data || null
    } catch {
        return null
    }
}
