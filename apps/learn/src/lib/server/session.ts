import type { NextApiRequest, NextApiResponse } from 'next'

const TOKEN_COOKIE_NAME = 'hovod_token'

export const readCookieValue = (cookieHeader: string | undefined, name: string): string | null => {
    if (!cookieHeader) return null
    const match = cookieHeader
        .split(';')
        .map((value) => value.trim())
        .find((cookie) => cookie.startsWith(`${name}=`))
    if (!match) return null
    return decodeURIComponent(match.slice(name.length + 1))
}

export const getTokenFromRequest = (req: { headers: { cookie?: string | undefined } }): string | null =>
    readCookieValue(req.headers.cookie, TOKEN_COOKIE_NAME)

const baseCookie = `${TOKEN_COOKIE_NAME}=`

export const setTokenCookie = (res: NextApiResponse, token: string): void => {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    res.setHeader('Set-Cookie', `${baseCookie}${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`)
}

export const clearTokenCookie = (res: NextApiResponse): void => {
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
    res.setHeader('Set-Cookie', `${baseCookie}; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`)
}

export const authHeaderFromRequest = (req: NextApiRequest): Record<string, string> => {
    const token = getTokenFromRequest(req)
    return token ? { authorization: 'Bearer '.concat(token) } : {}
}

export interface SessionUser {
    id: string
    email: string
    name?: string | null
}

export interface SessionInfo {
    user: SessionUser
    org: {
        id: string
        name: string
        slug: string
        tier: string
    }
}
