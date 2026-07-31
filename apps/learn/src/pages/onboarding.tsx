import type { GetServerSideProps, NextPage } from 'next'
import { FormEvent, useMemo, useState } from 'react'
import { readSession } from '../lib/server/auth'
import { readUserPreferences } from '../lib/server/preferences'

const CATEGORY_OPTIONS = ['psychology', 'philosophy', 'history', 'science', 'ai', 'business', 'health', 'arts']
const QUIZ_OPTIONS: Array<{ label: string; value: number }> = [
    { label: 'Off (no quizzes)', value: 0 },
    { label: 'Daily', value: 1 },
    { label: 'Every 3 days', value: 3 },
    { label: 'Weekly', value: 7 },
    { label: 'Biweekly', value: 14 },
    { label: 'Monthly', value: 30 },
]

const OnboardingPage: NextPage = () => {
    const [step, setStep] = useState(1)
    const [selectedCategories, setSelectedCategories] = useState<string[]>([])
    const [quizPeriodDays, setQuizPeriodDays] = useState(7)
    const [topics, setTopics] = useState('')
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    const canContinue = useMemo(() => selectedCategories.length >= 1, [selectedCategories])

    const onToggleCategory = (category: string) => {
        setSelectedCategories((current) =>
            current.includes(category) ? current.filter((item) => item !== category) : [...current, category]
        )
    }

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!canContinue) {
            setError('Pick at least one category')
            return
        }

        setSaving(true)
        setError('')

        const response = await fetch('/api/preferences', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                categories: selectedCategories,
                quizPeriodDays,
                onboardingCompleted: true,
                startTopics: topics,
            }),
        })
        const payload = await response.json().catch(() => ({})) as { error?: string }

        setSaving(false)
        if (!response.ok) {
            setError(payload.error || 'Failed to save onboarding')
            return
        }

        window.location.href = '/'
    }

    return (
        <main style={{ maxWidth: 760, margin: '0 auto', padding: '36px 16px', color: '#fff' }}>
            <h1 style={{ marginTop: 0 }}>Welcome to your learning stream</h1>
            <p style={{ color: '#a1a1aa' }}>Choose what to learn and how often to get retention quizzes.</p>

            <form onSubmit={onSubmit} style={{ background: '#18181b', borderRadius: 12, padding: 16 }}>
                {step === 1 && (
                    <>
                        <h2 style={{ marginTop: 0 }}>Step 1 · Categories</h2>
                        <p style={{ color: '#a1a1aa' }}>Pick at least one category (recommended 3-6).</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {CATEGORY_OPTIONS.map((category) => {
                                const selected = selectedCategories.includes(category)
                                return (
                                    <button
                                        key={category}
                                        type="button"
                                        onClick={() => onToggleCategory(category)}
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
                        <button type="button" onClick={() => setStep(2)} disabled={!canContinue} style={{ marginTop: 16 }}>
                            Continue
                        </button>
                    </>
                )}

                {step === 2 && (
                    <>
                        <h2 style={{ marginTop: 0 }}>Step 2 · Quiz cadence</h2>
                        <div style={{ display: 'grid', gap: 8 }}>
                            {QUIZ_OPTIONS.map((option) => (
                                <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input
                                        type="radio"
                                        checked={quizPeriodDays === option.value}
                                        onChange={() => setQuizPeriodDays(option.value)}
                                    />
                                    {option.label}
                                </label>
                            ))}
                        </div>
                        <label style={{ display: 'block', marginTop: 14 }}>
                            Start with these topics (optional)
                            <input
                                value={topics}
                                onChange={(e) => setTopics(e.target.value)}
                                placeholder="e.g. stoicism, game theory"
                                style={{ width: '100%', marginTop: 6 }}
                            />
                        </label>
                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <button type="button" onClick={() => setStep(1)}>Back</button>
                            <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Start learning'}</button>
                        </div>
                    </>
                )}

                {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
            </form>
        </main>
    )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const session = await readSession(context)
    if (!session) {
        return { redirect: { destination: '/login', permanent: false } }
    }

    const preferences = await readUserPreferences(context)
    if (preferences?.onboardingCompletedAt) {
        return { redirect: { destination: '/', permanent: false } }
    }

    return { props: {} }
}

export default OnboardingPage
