import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import type { ReactNode } from 'react'
import { theme } from '../../lib/theme'
import { isOwner, type SessionUser } from '../../lib/useSession'

interface NavLink {
    href: string
    label: string
    ownerOnly?: boolean
}

const CONSUMER_NAV: NavLink[] = [
    { href: '/', label: 'Home' },
    { href: '/saved', label: 'Library' },
    { href: '/profile', label: 'Profile' },
    { href: '/settings', label: 'Settings' },
]

const OWNER_NAV: NavLink[] = [
    { href: '/owner', label: 'Overview' },
    { href: '/owner/proposals', label: 'Proposals' },
    { href: '/owner/library', label: 'Library' },
    { href: '/owner/quizzes', label: 'Quiz bank' },
    { href: '/owner/pipeline', label: 'Pipeline' },
]

interface AppShellProps {
    title: string
    user: SessionUser | null
    variant?: 'consumer' | 'owner'
    children: ReactNode
    /** Constrain content width (default 1080). Use 'full' for edge-to-edge feed. */
    maxWidth?: number | 'full'
}

const AppShell = ({ title, user, variant = 'consumer', children, maxWidth = 1080 }: AppShellProps) => {
    const router = useRouter()
    const owner = isOwner(user)
    const nav = variant === 'owner' ? OWNER_NAV : CONSUMER_NAV

    const onLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/'
    }

    const isActive = (href: string) =>
        href === '/' || href === '/owner' ? router.pathname === href : router.pathname.startsWith(href)

    return (
        <>
            <Head>
                <title>{title}</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>
            <a href="#main-content" className="skip-link">
                Skip to content
            </a>
            <div style={{ minHeight: '100vh', background: theme.color.bg, color: theme.color.text }}>
                <header
                    style={{
                        borderBottom: `1px solid ${theme.color.border}`,
                        background: theme.color.surface,
                        position: 'sticky',
                        top: 0,
                        zIndex: 20,
                    }}
                >
                    <div
                        style={{
                            maxWidth: 1200,
                            margin: '0 auto',
                            padding: '0 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            minHeight: 60,
                        }}
                    >
                        <Link
                            href={variant === 'owner' ? '/owner' : '/'}
                            style={{ fontWeight: 700, fontSize: 16, color: theme.color.text, whiteSpace: 'nowrap' }}
                        >
                            Hovod{' '}
                            <span style={{ color: variant === 'owner' ? theme.color.accent : theme.color.primary }}>
                                {variant === 'owner' ? 'Studio' : 'Learn'}
                            </span>
                        </Link>

                        <nav aria-label="Primary" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                            {nav.map((link) => {
                                const active = isActive(link.href)
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        aria-current={active ? 'page' : undefined}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: theme.radius.pill,
                                            fontSize: 13,
                                            fontWeight: active ? 600 : 500,
                                            color: active ? theme.color.onPrimary : theme.color.textMuted,
                                            background: active ? theme.color.primary : 'transparent',
                                        }}
                                    >
                                        {link.label}
                                    </Link>
                                )
                            })}
                        </nav>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {owner && variant === 'consumer' && (
                                <Link
                                    href="/owner"
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: theme.radius.pill,
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: theme.color.accent,
                                        border: `1px solid ${theme.color.border}`,
                                    }}
                                >
                                    Owner ↗
                                </Link>
                            )}
                            {owner && variant === 'owner' && (
                                <Link
                                    href="/"
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: theme.radius.pill,
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: theme.color.primary,
                                        border: `1px solid ${theme.color.border}`,
                                    }}
                                >
                                    ↩ Consumer
                                </Link>
                            )}
                            <button
                                onClick={onLogout}
                                style={{
                                    padding: '8px 12px',
                                    borderRadius: theme.radius.pill,
                                    fontSize: 13,
                                    color: theme.color.textMuted,
                                    background: 'transparent',
                                    border: `1px solid ${theme.color.border}`,
                                    cursor: 'pointer',
                                }}
                            >
                                Log out
                            </button>
                        </div>
                    </div>
                </header>

                <main
                    id="main-content"
                    style={{
                        maxWidth: maxWidth === 'full' ? '100%' : maxWidth,
                        margin: '0 auto',
                        padding: maxWidth === 'full' ? 0 : '24px 16px 64px',
                    }}
                >
                    {children}
                </main>
            </div>
        </>
    )
}

export default AppShell
