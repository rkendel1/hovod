import type { GetServerSideProps, NextPage } from 'next'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { readSession } from '../../lib/server/auth'

const CATEGORY_OPTIONS = ['psychology', 'philosophy', 'history', 'science', 'ai', 'business', 'health', 'arts']
const QUIZ_OPTIONS: Array<{ label: string; value: number }> = [
    { label: 'Off (no quizzes)', value: 0 },
    { label: 'Daily', value: 1 },
    { label: 'Every 3 days', value: 3 },
    { label: 'Weekly', value: 7 },
    { label: 'Biweekly', value: 14 },
    { label: 'Monthly', value: 30 },
]

interface PreferencesData {
    categories: string[]
    quizPeriodDays: number
}

const PreferencesSettingsPage: NextPage = () => {
    const [data, setData] = useState<PreferencesData>({ categories: [], quizPeriodDays: 7 })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')

    useEffect(() => {
        fetch('/api/preferences')
            .then((response) => response.json())
            .then((payload) => {
                if (payload?.data) {
                    setData({
                        categories: Array.isArray(payload.data.categories) ? payload.data.categories : [],
                        quizPeriodDays: typeof payload.data.quizPeriodDays === 'number' ? payload.data.quizPeriodDays : 7,
                    })
                }
            })
            .finally(() => setLoading(false))
    }, [])

    const toggleCategory = (category: string) => {
        setData((current) => ({
            ...current,
            categories: current.categories.includes(category)
                ? current.categories.filter((item) => item !== category)
                : [...current.categories, category],
        }))
    }

    const save = async () => {
        if (data.categories.length < 1) {
            setMessage('Pick at least one category')
            return
        }

        setSaving(true)
        setMessage('')
        const response = await fetch('/api/preferences', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(data),
        })
        const payload = await response.json().catch(() => ({})) as { error?: string }
        setSaving(false)

        if (!response.ok) {
            setMessage(payload.error || 'Failed to save preferences')
            return
        }

        setMessage('Preferences saved')
    }

    const resetOnboarding = async () => {
        setSaving(true)
        const response = await fetch('/api/preferences', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ onboardingCompleted: false }),
        })
        setSaving(false)
        if (response.ok) {
            window.location.href = '/onboarding'
        }
    }

    return (
        <main style={{ maxWidth: 760, margin: '0 auto', padding: 24, color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h1 style={{ margin: 0 }}>Learning preferences</h1>
                <Link href="/">Back to feed</Link>
            </div>

            {loading ? (
                <p>Loading...</p>
            ) : (
                <section style={{ background: '#18181b', borderRadius: 12, padding: 16 }}>
                    <h2 style={{ marginTop: 0 }}>Categories</h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                        {CATEGORY_OPTIONS.map((category) => {
                            const selected = data.categories.includes(category)
                            return (
                                <button
                                    key={category}
                                    type="button"
                                    onClick={() => toggleCategory(category)}
                                    style={{
                                        borderRadius: 999,
                                        border: selected ? '1px solid #6366f1' : '1px solid #3f3f46',
                                        background: selected ? '#312e81' : '#27272a',
                                        color: '#fff',
                                        padding: '8px 12px',
                                    }}
                                >
                                    {category}
                                </button>
                            )
                        })}
                    </div>

                    <h2 style={{ marginTop: 0 }}>Quiz cadence</h2>
                    <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                        {QUIZ_OPTIONS.map((option) => (
                            <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                    type="radio"
                                    checked={data.quizPeriodDays === option.value}
                                    onChange={() => setData((current) => ({ ...current, quizPeriodDays: option.value }))}
                                />
                                {option.label}
                            </label>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save preferences'}</button>
                        <button onClick={resetOnboarding} disabled={saving}>Reset onboarding</button>
                        <button onClick={() => (window.location.href = '/')} disabled={saving}>Refresh my stream</button>
                    </div>

                    {message && <p style={{ marginBottom: 0 }}>{message}</p>}
                </section>
            )}
        </main>
    )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const session = await readSession(context)
    if (!session) {
        return { redirect: { destination: '/login', permanent: false } }
    }

    return { props: {} }
}

export default PreferencesSettingsPage
