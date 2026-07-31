import type { GetServerSideProps, NextPage } from 'next'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppShell from '../components/shell/AppShell'
import { theme } from '../lib/theme'
import { useSession } from '../lib/useSession'
import { readSession } from '../lib/server/auth'

const CATEGORY_OPTIONS = ['psychology', 'philosophy', 'history', 'science', 'ai', 'business', 'health', 'arts']
const QUIZ_OPTIONS: { label: string; value: number }[] = [
    { label: 'Off (no quizzes)', value: 0 },
    { label: 'Daily', value: 1 },
    { label: 'Every 3 days', value: 3 },
    { label: 'Weekly', value: 7 },
    { label: 'Biweekly', value: 14 },
    { label: 'Monthly', value: 30 },
]

const SettingsPage: NextPage = () => {
    const { loading: sessionLoading, user } = useSession()
    const [categories, setCategories] = useState<string[]>([])
    const [quizPeriodDays, setQuizPeriodDays] = useState(7)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')

    useEffect(() => {
        fetch('/api/me/preferences')
            .then((r) => r.json())
            .then((payload) => {
                if (payload?.data) {
                    setCategories(Array.isArray(payload.data.categories) ? payload.data.categories : [])
                    setQuizPeriodDays(typeof payload.data.quizPeriodDays === 'number' ? payload.data.quizPeriodDays : 7)
                }
            })
            .finally(() => setLoading(false))
    }, [])

    const toggleCategory = (category: string) => {
        setCategories((current) =>
            current.includes(category) ? current.filter((c) => c !== category) : [...current, category]
        )
    }

    const save = async () => {
        if (categories.length < 1) {
            setMessage('Pick at least one category')
            return
        }
        setSaving(true)
        setMessage('')
        const response = await fetch('/api/me/preferences', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ categories, quizPeriodDays }),
        })
        setSaving(false)
        setMessage(response.ok ? 'Preferences saved' : 'Failed to save preferences')
    }

    const resetOnboarding = async () => {
        setSaving(true)
        const response = await fetch('/api/me/preferences', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ onboardingCompleted: false }),
        })
        setSaving(false)
        if (response.ok) window.location.href = '/onboarding'
    }

    if (sessionLoading) return <main style={{ color: theme.color.text, padding: 24 }}>Loading…</main>

    return (
        <AppShell title="Settings · Hovod Learn" user={user} maxWidth={720}>
            <h1 style={{ margin: '0 0 20px', fontSize: 24 }}>Settings</h1>

            {loading ? (
                <p style={{ color: theme.color.textMuted }}>Loading…</p>
            ) : (
                <>
                    <section style={panel}>
                        <h2 style={{ fontSize: 16, marginTop: 0 }}>Topics</h2>
                        <p style={{ color: theme.color.textMuted, fontSize: 14, marginTop: 0 }}>
                            Your stream is ranked toward these categories (with a little exploration).
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {CATEGORY_OPTIONS.map((category) => {
                                const selected = categories.includes(category)
                                return (
                                    <button
                                        key={category}
                                        type="button"
                                        onClick={() => toggleCategory(category)}
                                        aria-pressed={selected}
                                        style={{
                                            borderRadius: theme.radius.pill,
                                            border: `1px solid ${selected ? theme.color.primary : theme.color.border}`,
                                            background: selected ? theme.color.primary : 'transparent',
                                            color: selected ? theme.color.onPrimary : theme.color.textMuted,
                                            padding: '8px 14px',
                                            fontWeight: 600,
                                            fontSize: 13,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {category}
                                    </button>
                                )
                            })}
                        </div>
                    </section>

                    <section style={panel}>
                        <h2 style={{ fontSize: 16, marginTop: 0 }}>Quiz cadence</h2>
                        <div style={{ display: 'grid', gap: 8 }}>
                            {QUIZ_OPTIONS.map((option) => (
                                <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="quiz"
                                        checked={quizPeriodDays === option.value}
                                        onChange={() => setQuizPeriodDays(option.value)}
                                    />
                                    {option.label}
                                </label>
                            ))}
                        </div>
                    </section>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                        <button onClick={save} disabled={saving} style={primaryButton}>
                            {saving ? 'Saving…' : 'Save preferences'}
                        </button>
                        <button onClick={resetOnboarding} disabled={saving} style={ghostButton}>
                            Re-run onboarding
                        </button>
                        {message && (
                            <span style={{ fontSize: 13, color: message.includes('saved') ? theme.color.success : theme.color.danger }}>
                                {message}
                            </span>
                        )}
                    </div>

                    <section style={{ ...panel, marginTop: 20 }}>
                        <h2 style={{ fontSize: 16, marginTop: 0 }}>Account</h2>
                        <p style={{ color: theme.color.textMuted, fontSize: 14, margin: '0 0 4px' }}>{user?.email}</p>
                        {user?.role === 'owner' && (
                            <Link href="/settings/hovod" style={{ color: theme.color.accent, fontSize: 14 }}>
                                Platform settings (owner) →
                            </Link>
                        )}
                    </section>
                </>
            )}
        </AppShell>
    )
}

const panel: React.CSSProperties = {
    background: theme.color.surface,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md,
    padding: 16,
    marginBottom: 16,
}
const primaryButton: React.CSSProperties = {
    padding: '10px 18px',
    borderRadius: theme.radius.pill,
    border: 0,
    background: theme.color.primary,
    color: theme.color.onPrimary,
    fontWeight: 600,
    cursor: 'pointer',
}
const ghostButton: React.CSSProperties = {
    padding: '10px 18px',
    borderRadius: theme.radius.pill,
    border: `1px solid ${theme.color.border}`,
    background: 'transparent',
    color: theme.color.text,
    cursor: 'pointer',
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const session = await readSession(context)
    if (!session) return { redirect: { destination: '/login', permanent: false } }
    return { props: {} }
}

export default SettingsPage
