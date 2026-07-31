import type { GetServerSidePropsContext } from 'next'
import { getHovodBaseUrl } from './hovod'
import { getTokenFromRequest } from './session'

export interface UserPreferences {
    userId: string
    categories: string[]
    quizPeriodDays: number
    onboardingCompletedAt: string | null
    feedDiversity: number
}

export const readUserPreferences = async (context: GetServerSidePropsContext): Promise<UserPreferences | null> => {
    const token = getTokenFromRequest(context.req)
    if (!token) return null

    try {
        const response = await fetch(`${getHovodBaseUrl()}/v1/learn/preferences`, {
            headers: { authorization: 'Bearer '.concat(token) },
        })
        if (!response.ok) return null
        const payload = await response.json().catch(() => ({})) as { data?: UserPreferences }
        return payload?.data || null
    } catch {
        return null
    }
}
