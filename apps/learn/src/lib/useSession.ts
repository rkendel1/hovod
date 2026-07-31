import { useEffect, useState } from 'react'

export interface SessionUser {
    id: string
    email: string
    name?: string | null
    role: 'user' | 'owner'
}

interface SessionState {
    loading: boolean
    user: SessionUser | null
}

/** Client hook that resolves the current session from /api/auth/me. */
export const useSession = (): SessionState => {
    const [state, setState] = useState<SessionState>({ loading: true, user: null })

    useEffect(() => {
        let active = true
        fetch('/api/auth/me')
            .then(async (response) => {
                if (!active) return
                if (!response.ok) {
                    setState({ loading: false, user: null })
                    return
                }
                const payload = (await response.json().catch(() => ({}))) as { data?: { user?: SessionUser } }
                const user = payload?.data?.user || null
                setState({ loading: false, user: user ? { ...user, role: user.role === 'owner' ? 'owner' : 'user' } : null })
            })
            .catch(() => {
                if (active) setState({ loading: false, user: null })
            })
        return () => {
            active = false
        }
    }, [])

    return state
}

export const isOwner = (user: SessionUser | null): boolean => user?.role === 'owner'
