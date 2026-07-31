import type { NextApiRequest } from 'next'

const API_BASE_FALLBACK = 'http://api:3000'

export const getHovodBaseUrl = () =>
    (process.env.HOVOD_API_BASE_URL || process.env.HOVOD_BASE_URL || API_BASE_FALLBACK).replace(/\/$/, '')

const getApiKey = () => {
    const key = process.env.HOVOD_API_KEY
    if (!key) throw new Error('Missing HOVOD_API_KEY')
    return key
}

const readCookieValue = (cookieHeader: string | undefined, name: string): string | null => {
    if (!cookieHeader) return null
    const match = cookieHeader
        .split(';')
        .map((value) => value.trim())
        .find((cookie) => cookie.startsWith(`${name}=`))
    if (!match) return null
    return decodeURIComponent(match.slice(name.length + 1))
}

export const getForwardedAuthHeaders = (req: NextApiRequest): Record<string, string> => {
    const authorization =
        (typeof req.headers.authorization === 'string' && req.headers.authorization) ||
        readCookieValue(req.headers.cookie, 'hovod_token')

    if (authorization) {
        const hasBearerPrefix = authorization.slice(0, 7).toLowerCase() === 'bearer '
        return {
            authorization: hasBearerPrefix ? authorization : 'Bearer '.concat(authorization),
        }
    }

    return {
        'x-api-key': getApiKey(),
    }
}

export const forwardHovodRequest = async (
    req: NextApiRequest,
    path: string,
    init?: RequestInit
): Promise<Response> => {
    const baseUrl = getHovodBaseUrl()
    const headers = {
        ...getForwardedAuthHeaders(req),
        ...(init?.headers || {}),
    }

    return fetch(`${baseUrl}${path}`, {
        ...init,
        headers,
    })
}
