import Hls from 'hls.js'
import type { NextPage } from 'next'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import AppShell from '../components/shell/AppShell'
import { theme } from '../lib/theme'
import { useSession } from '../lib/useSession'

type CollectionType = 'saved' | 'liked' | 'commented'

interface ClipItem {
    id: string
    title: string
    playbackId: string
    playbackUrl: string | null
    duration: number | null
}

const TABS: { key: CollectionType; label: string }[] = [
    { key: 'saved', label: 'Saved' },
    { key: 'liked', label: 'Liked' },
    { key: 'commented', label: 'Commented' },
]

const InlinePlayer = ({ url }: { url: string }) => {
    const ref = useRef<HTMLVideoElement | null>(null)
    useEffect(() => {
        const element = ref.current
        if (!element) return
        if (element.canPlayType('application/vnd.apple.mpegurl')) {
            element.src = url
            return
        }
        if (Hls.isSupported()) {
            const hls = new Hls()
            hls.loadSource(url)
            hls.attachMedia(element)
            return () => hls.destroy()
        }
    }, [url])
    return (
        <video
            ref={ref}
            controls
            playsInline
            style={{ width: '100%', maxHeight: '60vh', aspectRatio: '9 / 16', objectFit: 'contain', background: '#000', borderRadius: 8, marginTop: 8 }}
        />
    )
}

const SavedPage: NextPage = () => {
    const { loading, user } = useSession()
    const [tab, setTab] = useState<CollectionType>('saved')
    const [items, setItems] = useState<ClipItem[]>([])
    const [busy, setBusy] = useState(false)
    const [openId, setOpenId] = useState<string | null>(null)

    useEffect(() => {
        if (!user) return
        setBusy(true)
        setOpenId(null)
        fetch(`/api/collections?type=${tab}`)
            .then((r) => r.json())
            .then((payload) => setItems(payload?.data?.items || []))
            .catch(() => setItems([]))
            .finally(() => setBusy(false))
    }, [user, tab])

    if (loading) return <main style={{ color: theme.color.text, padding: 24 }}>Loading…</main>
    if (!user) {
        return (
            <main style={{ color: theme.color.text, padding: 24 }}>
                Please <Link href="/login" style={{ color: theme.color.primary }}>log in</Link>.
            </main>
        )
    }

    return (
        <AppShell title="Library · Hovod Learn" user={user}>
            <h1 style={{ margin: '0 0 16px', fontSize: 24 }}>Your library</h1>

            <div role="tablist" aria-label="Collections" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {TABS.map((t) => {
                    const active = tab === t.key
                    return (
                        <button
                            key={t.key}
                            role="tab"
                            aria-selected={active}
                            onClick={() => setTab(t.key)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: theme.radius.pill,
                                border: `1px solid ${active ? theme.color.primary : theme.color.border}`,
                                background: active ? theme.color.primary : 'transparent',
                                color: active ? theme.color.onPrimary : theme.color.textMuted,
                                fontWeight: 600,
                                fontSize: 13,
                                cursor: 'pointer',
                            }}
                        >
                            {t.label}
                        </button>
                    )
                })}
            </div>

            {busy ? (
                <p style={{ color: theme.color.textMuted }}>Loading…</p>
            ) : items.length === 0 ? (
                <p style={{ color: theme.color.textMuted }}>Nothing here yet.</p>
            ) : (
                <ul style={{ listStyle: 'none', display: 'grid', gap: 10 }}>
                    {items.map((item) => {
                        const open = openId === item.id
                        return (
                            <li
                                key={item.id}
                                style={{
                                    padding: '12px 16px',
                                    borderRadius: theme.radius.md,
                                    background: theme.color.surface,
                                    border: `1px solid ${open ? theme.color.primary : theme.color.border}`,
                                }}
                            >
                                <button
                                    onClick={() => setOpenId(open ? null : item.id)}
                                    aria-expanded={open}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        width: '100%',
                                        background: 'transparent',
                                        border: 0,
                                        color: theme.color.text,
                                        cursor: item.playbackUrl ? 'pointer' : 'default',
                                        fontSize: 15,
                                        fontWeight: 500,
                                        textAlign: 'left',
                                    }}
                                >
                                    <span>{item.title}</span>
                                    <span style={{ color: theme.color.textSubtle, fontSize: 13 }}>{open ? '▲ Close' : '▶ Play'}</span>
                                </button>
                                {open && item.playbackUrl && <InlinePlayer url={item.playbackUrl} />}
                            </li>
                        )
                    })}
                </ul>
            )}
        </AppShell>
    )
}

export default SavedPage
