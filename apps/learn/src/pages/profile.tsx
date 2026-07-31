import type { NextPage } from 'next'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppShell from '../components/shell/AppShell'
import { theme } from '../lib/theme'
import { useSession } from '../lib/useSession'

interface ProfileData {
    stats: {
        clipsViewed: number
        clipsCompleted: number
        saved: number
        liked: number
        shares: number
        activeDays: number
        quiz: { correct: number; wrong: number; total: number; accuracy: number | null }
    }
    topCategories: { category: string; count: number }[]
}

const StatTile = ({ label, value }: { label: string; value: string | number }) => (
    <div
        style={{
            background: theme.color.surface,
            border: `1px solid ${theme.color.border}`,
            borderRadius: theme.radius.md,
            padding: 16,
        }}
    >
        <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
        <div style={{ fontSize: 12, color: theme.color.textMuted, marginTop: 2 }}>{label}</div>
    </div>
)

const ProfilePage: NextPage = () => {
    const { loading, user } = useSession()
    const [data, setData] = useState<ProfileData | null>(null)

    useEffect(() => {
        if (!user) return
        fetch('/api/profile')
            .then((r) => r.json())
            .then((payload) => setData(payload?.data || null))
            .catch(() => undefined)
    }, [user])

    if (loading) return <main style={{ color: theme.color.text, padding: 24 }}>Loading…</main>
    if (!user) {
        return (
            <main style={{ color: theme.color.text, padding: 24 }}>
                Please <Link href="/login" style={{ color: theme.color.primary }}>log in</Link>.
            </main>
        )
    }

    const s = data?.stats

    return (
        <AppShell title="Profile · Hovod Learn" user={user}>
            <header style={{ marginBottom: 20 }}>
                <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>{user.name || user.email}</h1>
                <p style={{ margin: 0, color: theme.color.textMuted, fontSize: 14 }}>{user.email}</p>
            </header>

            {!data ? (
                <p style={{ color: theme.color.textMuted }}>Loading your learning stats…</p>
            ) : (
                <>
                    <section
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                            gap: 12,
                            marginBottom: 24,
                        }}
                    >
                        <StatTile label="Clips completed" value={s?.clipsCompleted ?? 0} />
                        <StatTile label="Clips viewed" value={s?.clipsViewed ?? 0} />
                        <StatTile label="Active days" value={s?.activeDays ?? 0} />
                        <StatTile
                            label="Quiz accuracy"
                            value={s?.quiz.accuracy !== null && s?.quiz.accuracy !== undefined ? `${s.quiz.accuracy}%` : '—'}
                        />
                        <StatTile label="Saved" value={s?.saved ?? 0} />
                        <StatTile label="Liked" value={s?.liked ?? 0} />
                        <StatTile label="Shares" value={s?.shares ?? 0} />
                        <StatTile label="Quizzes taken" value={s?.quiz.total ?? 0} />
                    </section>

                    <section style={{ marginBottom: 24 }}>
                        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Top topics</h2>
                        {data.topCategories.length === 0 ? (
                            <p style={{ color: theme.color.textMuted, fontSize: 14 }}>
                                Complete some clips and your strongest topics will show here.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {data.topCategories.map((item) => (
                                    <span
                                        key={item.category}
                                        style={{
                                            padding: '6px 12px',
                                            borderRadius: theme.radius.pill,
                                            background: theme.color.surfaceRaised,
                                            fontSize: 13,
                                        }}
                                    >
                                        {item.category} · {item.count}
                                    </span>
                                ))}
                            </div>
                        )}
                    </section>

                    <div style={{ display: 'flex', gap: 12 }}>
                        <Link href="/saved" style={{ color: theme.color.primary, fontWeight: 600 }}>
                            View your library →
                        </Link>
                        <Link href="/settings" style={{ color: theme.color.textMuted }}>
                            Edit preferences
                        </Link>
                    </div>
                </>
            )}
        </AppShell>
    )
}

export default ProfilePage
