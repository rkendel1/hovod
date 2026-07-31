import Link from 'next/link'
import type { ReactNode } from 'react'
import { theme } from '../../lib/theme'
import type { SessionUser } from '../../lib/useSession'

interface OwnerGuardProps {
    loading: boolean
    user: SessionUser | null
    children: ReactNode
}

/** Gates owner (back door) routes. Consumers never see owner surfaces. */
const OwnerGuard = ({ loading, user, children }: OwnerGuardProps) => {
    if (loading) {
        return <main style={{ color: theme.color.text, padding: 24 }}>Loading…</main>
    }

    if (!user) {
        return (
            <main style={{ color: theme.color.text, padding: 24 }}>
                Please <Link href="/login" style={{ color: theme.color.primary }}>log in</Link>.
            </main>
        )
    }

    if (user.role !== 'owner') {
        return (
            <main style={{ maxWidth: 520, margin: '0 auto', padding: '64px 24px', color: theme.color.text, textAlign: 'center' }}>
                <h1 style={{ fontSize: 22, marginBottom: 8 }}>Owner access only</h1>
                <p style={{ color: theme.color.textMuted, marginBottom: 20 }}>
                    This is the platform back door. Your account doesn&apos;t have owner permissions.
                </p>
                <Link
                    href="/"
                    style={{
                        display: 'inline-block',
                        padding: '10px 20px',
                        borderRadius: theme.radius.pill,
                        background: theme.color.primary,
                        color: theme.color.onPrimary,
                        fontWeight: 600,
                    }}
                >
                    Back to your stream
                </Link>
            </main>
        )
    }

    return <>{children}</>
}

export default OwnerGuard
