import type { NextPage } from 'next'
import { useCallback, useEffect, useState } from 'react'
import AppShell from '../../components/shell/AppShell'
import OwnerGuard from '../../components/shell/OwnerGuard'
import { statusColor, theme } from '../../lib/theme'
import { useSession } from '../../lib/useSession'

interface Engagement {
    views: number
    completes: number
    likes: number
    saves: number
    shares: number
    comments: number
}

interface LibraryItem {
    id: string
    title: string
    assetStatus: string
    publishStatus: string
    featured: boolean
    categories: string[]
    tags: string[]
    quizQuestionCount: number
    engagement: Engagement
    duration: number | null
}

const OwnerLibrary: NextPage = () => {
    const { loading, user } = useSession()
    const [items, setItems] = useState<LibraryItem[]>([])
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')

    const load = useCallback(() => {
        setBusy(true)
        fetch('/api/owner/assets')
            .then((r) => r.json())
            .then((payload) => setItems(payload?.data?.items || []))
            .catch(() => setItems([]))
            .finally(() => setBusy(false))
    }, [])

    useEffect(() => {
        if (user?.role === 'owner') load()
    }, [user, load])

    const patch = async (id: string, body: Record<string, unknown>) => {
        setMessage('')
        const response = await fetch(`/api/owner/assets/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
            setMessage(payload?.error || 'Update failed')
            return
        }
        load()
    }

    const editCategories = (item: LibraryItem) => {
        const next = window.prompt('Categories (comma-separated)', item.categories.join(', '))
        if (next === null) return
        const categories = next.split(',').map((c) => c.trim()).filter(Boolean)
        void patch(item.id, { categories })
    }

    return (
        <OwnerGuard loading={loading} user={user}>
            <AppShell title="Library · Hovod Studio" user={user} variant="owner">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h1 style={{ margin: 0, fontSize: 24 }}>Library</h1>
                    <button onClick={load} style={ghostButton}>Refresh</button>
                </div>
                <p style={{ margin: '0 0 16px', color: theme.color.textMuted, fontSize: 14 }}>
                    Only published assets enter the consumer feed. Feature to boost ranking.
                </p>
                {message && <p style={{ color: theme.color.danger }}>{message}</p>}

                {busy && items.length === 0 ? (
                    <p style={{ color: theme.color.textMuted }}>Loading…</p>
                ) : items.length === 0 ? (
                    <p style={{ color: theme.color.textMuted }}>No assets yet. Approve a proposal to generate one.</p>
                ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                        {items.map((item) => (
                            <div
                                key={item.id}
                                style={{
                                    background: theme.color.surface,
                                    border: `1px solid ${item.featured ? theme.color.primary : theme.color.border}`,
                                    borderRadius: theme.radius.md,
                                    padding: 16,
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                    <div style={{ minWidth: 200, flex: 1 }}>
                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.title}</div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                            <Badge label={item.publishStatus} color={statusColor(item.publishStatus)} />
                                            {item.assetStatus !== 'ready' && <Badge label={item.assetStatus} color={statusColor(item.assetStatus)} />}
                                            {item.featured && <Badge label="featured" color={theme.color.primary} />}
                                            <span style={{ fontSize: 12, color: theme.color.textSubtle }}>
                                                {item.quizQuestionCount} quiz Q
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                        {item.publishStatus === 'published' ? (
                                            <button onClick={() => patch(item.id, { status: 'draft' })} style={ghostButton}>Unpublish</button>
                                        ) : (
                                            <button
                                                onClick={() => patch(item.id, { status: 'published' })}
                                                disabled={item.assetStatus !== 'ready'}
                                                style={primaryButton}
                                            >
                                                Publish
                                            </button>
                                        )}
                                        <button onClick={() => patch(item.id, { featured: !item.featured })} style={ghostButton}>
                                            {item.featured ? 'Unfeature' : 'Feature'}
                                        </button>
                                        <button onClick={() => editCategories(item)} style={ghostButton}>Categories</button>
                                    </div>
                                </div>

                                {item.categories.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                                        {item.categories.map((category) => (
                                            <span key={category} style={chip}>{category}</span>
                                        ))}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', fontSize: 12, color: theme.color.textMuted }}>
                                    <Metric label="Views" value={item.engagement.views} />
                                    <Metric label="Completes" value={item.engagement.completes} />
                                    <Metric label="Likes" value={item.engagement.likes} />
                                    <Metric label="Saves" value={item.engagement.saves} />
                                    <Metric label="Shares" value={item.engagement.shares} />
                                    <Metric label="Comments" value={item.engagement.comments} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </AppShell>
        </OwnerGuard>
    )
}

const Badge = ({ label, color }: { label: string; color: string }) => (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: theme.radius.pill, background: `${color}22`, color }}>
        {label}
    </span>
)

const Metric = ({ label, value }: { label: string; value: number }) => (
    <span><strong style={{ color: theme.color.text }}>{value}</strong> {label}</span>
)

const chip: React.CSSProperties = {
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: theme.radius.pill,
    background: theme.color.surfaceRaised,
    color: theme.color.textMuted,
}

const primaryButton: React.CSSProperties = {
    padding: '7px 14px',
    borderRadius: theme.radius.pill,
    border: 0,
    background: theme.color.primary,
    color: theme.color.onPrimary,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
}

const ghostButton: React.CSSProperties = {
    padding: '7px 14px',
    borderRadius: theme.radius.pill,
    border: `1px solid ${theme.color.border}`,
    background: 'transparent',
    color: theme.color.text,
    fontSize: 13,
    cursor: 'pointer',
}

export default OwnerLibrary
