import type { NextPage } from 'next'
import { useEffect, useState } from 'react'
import AppShell from '../../components/shell/AppShell'
import OwnerGuard from '../../components/shell/OwnerGuard'
import { theme } from '../../lib/theme'
import { useSession } from '../../lib/useSession'

interface LibraryItem {
    id: string
    title: string
    quizQuestionCount: number
}

interface Question {
    id?: string
    prompt: string
    choices?: string[]
    answer: string
    explanation?: string
}

const emptyQuestion = (): Question => ({ prompt: '', choices: ['', ''], answer: '', explanation: '' })

const OwnerQuizzes: NextPage = () => {
    const { loading, user } = useSession()
    const [assets, setAssets] = useState<LibraryItem[]>([])
    const [selected, setSelected] = useState<string | null>(null)
    const [questions, setQuestions] = useState<Question[]>([])
    const [message, setMessage] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (user?.role !== 'owner') return
        fetch('/api/owner/assets')
            .then((r) => r.json())
            .then((payload) => setAssets(payload?.data?.items || []))
            .catch(() => undefined)
    }, [user])

    const selectAsset = async (id: string) => {
        setSelected(id)
        setMessage('')
        const response = await fetch(`/api/owner/assets/${encodeURIComponent(id)}/quiz`)
        const payload = await response.json().catch(() => ({}))
        const list: Question[] = payload?.data?.questions || []
        setQuestions(list.length > 0 ? list : [emptyQuestion()])
    }

    const updateQuestion = (index: number, patch: Partial<Question>) => {
        setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)))
    }

    const updateChoice = (qIndex: number, cIndex: number, value: string) => {
        setQuestions((prev) =>
            prev.map((q, i) => {
                if (i !== qIndex) return q
                const choices = [...(q.choices || [])]
                choices[cIndex] = value
                return { ...q, choices }
            })
        )
    }

    const save = async () => {
        if (!selected) return
        setSaving(true)
        setMessage('')
        const cleaned = questions
            .map((q) => ({
                ...q,
                choices: (q.choices || []).map((c) => c.trim()).filter(Boolean),
            }))
            .filter((q) => q.prompt.trim() && q.answer.trim())
        const response = await fetch(`/api/owner/assets/${encodeURIComponent(selected)}/quiz`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ questions: cleaned }),
        })
        const payload = await response.json().catch(() => ({}))
        setSaving(false)
        setMessage(response.ok ? 'Saved' : payload?.error || 'Save failed')
    }

    return (
        <OwnerGuard loading={loading} user={user}>
            <AppShell title="Quiz bank · Hovod Studio" user={user} variant="owner">
                <h1 style={{ margin: '0 0 16px', fontSize: 24 }}>Quiz bank</h1>
                <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
                    <aside style={{ background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: 10, maxHeight: 600, overflowY: 'auto' }}>
                        {assets.map((asset) => (
                            <button
                                key={asset.id}
                                onClick={() => selectAsset(asset.id)}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: 10,
                                    marginBottom: 6,
                                    borderRadius: theme.radius.sm,
                                    border: 0,
                                    cursor: 'pointer',
                                    background: selected === asset.id ? theme.color.surfaceHover : 'transparent',
                                    color: theme.color.text,
                                }}
                            >
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{asset.title}</div>
                                <div style={{ fontSize: 11, color: theme.color.textSubtle }}>{asset.quizQuestionCount} questions</div>
                            </button>
                        ))}
                        {assets.length === 0 && <p style={{ color: theme.color.textMuted, fontSize: 13 }}>No assets yet.</p>}
                    </aside>

                    <section>
                        {!selected ? (
                            <p style={{ color: theme.color.textMuted }}>Select an asset to edit its quiz.</p>
                        ) : (
                            <>
                                {questions.map((question, index) => (
                                    <div key={index} style={{ background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: 14, marginBottom: 12 }}>
                                        <label style={labelStyle}>Prompt</label>
                                        <input value={question.prompt} onChange={(e) => updateQuestion(index, { prompt: e.target.value })} style={inputStyle} />
                                        <label style={labelStyle}>Choices</label>
                                        {(question.choices || ['', '']).map((choice, cIndex) => (
                                            <input
                                                key={cIndex}
                                                value={choice}
                                                placeholder={`Choice ${cIndex + 1}`}
                                                onChange={(e) => updateChoice(index, cIndex, e.target.value)}
                                                style={{ ...inputStyle, marginBottom: 6 }}
                                            />
                                        ))}
                                        <button
                                            onClick={() => updateQuestion(index, { choices: [...(question.choices || []), ''] })}
                                            style={{ ...ghostButton, marginBottom: 10 }}
                                        >
                                            + Add choice
                                        </button>
                                        <label style={labelStyle}>Correct answer</label>
                                        <input value={question.answer} onChange={(e) => updateQuestion(index, { answer: e.target.value })} style={inputStyle} />
                                        <label style={labelStyle}>Explanation (optional)</label>
                                        <input value={question.explanation || ''} onChange={(e) => updateQuestion(index, { explanation: e.target.value })} style={inputStyle} />
                                        <button onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== index))} style={{ ...ghostButton, marginTop: 8, color: theme.color.danger }}>
                                            Remove question
                                        </button>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                    <button onClick={() => setQuestions((prev) => [...prev, emptyQuestion()])} style={ghostButton}>+ Add question</button>
                                    <button onClick={save} disabled={saving} style={primaryButton}>{saving ? 'Saving…' : 'Save quiz'}</button>
                                    {message && <span style={{ color: message === 'Saved' ? theme.color.success : theme.color.danger, fontSize: 13 }}>{message}</span>}
                                </div>
                            </>
                        )}
                    </section>
                </div>
            </AppShell>
        </OwnerGuard>
    )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: theme.color.textMuted, margin: '8px 0 4px' }
const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.color.border}`,
    background: theme.color.bg,
    color: theme.color.text,
    fontSize: 14,
}
const primaryButton: React.CSSProperties = {
    padding: '9px 18px',
    borderRadius: theme.radius.pill,
    border: 0,
    background: theme.color.primary,
    color: theme.color.onPrimary,
    fontWeight: 600,
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

export default OwnerQuizzes
