import { useEffect, useState } from 'react'
import { theme } from '../../lib/theme'
import type { QuizQuestion } from '../../types/video'

interface QuizCardProps {
    assetId: string
    onClose: () => void
}

/**
 * Retention quiz interstitial. Fetches due questions for this user+asset,
 * grades client-side, and posts the result to reschedule the next quiz.
 */
const QuizCard = ({ assetId, onClose }: QuizCardProps) => {
    const [questions, setQuestions] = useState<QuizQuestion[]>([])
    const [index, setIndex] = useState(0)
    const [chosen, setChosen] = useState<string | null>(null)
    const [correctCount, setCorrectCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [done, setDone] = useState(false)

    useEffect(() => {
        let active = true
        fetch(`/api/quizzes/${encodeURIComponent(assetId)}`)
            .then(async (response) => {
                const payload = (await response.json().catch(() => ({}))) as {
                    data?: { quizDue?: boolean; questions?: QuizQuestion[] }
                }
                if (!active) return
                const list = payload?.data?.quizDue ? payload.data.questions || [] : []
                setQuestions(list)
                setLoading(false)
                if (list.length === 0) onClose()
            })
            .catch(() => {
                if (active) {
                    setLoading(false)
                    onClose()
                }
            })
        return () => {
            active = false
        }
    }, [assetId, onClose])

    const current = questions[index]

    const submit = async (allCorrect: boolean) => {
        await fetch(`/api/quizzes/${encodeURIComponent(assetId)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ correct: allCorrect }),
        }).catch(() => undefined)
    }

    const choose = (choice: string) => {
        if (chosen) return
        setChosen(choice)
        if (current && choice === current.answer) setCorrectCount((c) => c + 1)
    }

    const next = () => {
        const wasLast = index >= questions.length - 1
        if (wasLast) {
            // correctCount already reflects the final answer (set in choose()).
            void submit(correctCount >= Math.ceil(questions.length / 2))
            setDone(true)
            return
        }
        setIndex((i) => i + 1)
        setChosen(null)
    }

    if (loading) {
        return (
            <div style={panelStyle} role="status" aria-live="polite">
                Loading quiz…
            </div>
        )
    }

    if (done) {
        return (
            <div style={panelStyle} role="dialog" aria-label="Quiz complete">
                <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
                    Nice — {correctCount}/{questions.length} recalled.
                </p>
                <p style={{ margin: '0 0 12px', color: theme.color.textMuted, fontSize: 13 }}>
                    Your next quiz for this clip is scheduled on your retention cadence.
                </p>
                <button style={primaryButton} onClick={onClose}>
                    Continue
                </button>
            </div>
        )
    }

    if (!current) return null

    const choices = current.choices && current.choices.length > 0 ? current.choices : [current.answer]

    return (
        <div style={panelStyle} role="dialog" aria-label="Retention quiz">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: theme.color.accent, fontWeight: 600 }}>
                    Retention check {index + 1}/{questions.length}
                </span>
                <button onClick={onClose} aria-label="Dismiss quiz" style={dismissButton}>
                    ✕
                </button>
            </div>
            <p style={{ margin: '0 0 12px', fontWeight: 600 }}>{current.prompt}</p>
            <div style={{ display: 'grid', gap: 8 }}>
                {choices.map((choice) => {
                    const isChosen = chosen === choice
                    const isAnswer = choice === current.answer
                    const showState = chosen !== null
                    let background: string = theme.color.surfaceRaised
                    if (showState && isAnswer) background = 'rgba(34,197,94,0.25)'
                    else if (showState && isChosen && !isAnswer) background = 'rgba(239,68,68,0.25)'
                    return (
                        <button
                            key={choice}
                            onClick={() => choose(choice)}
                            aria-pressed={isChosen}
                            disabled={chosen !== null}
                            style={{
                                textAlign: 'left',
                                padding: '10px 12px',
                                borderRadius: theme.radius.sm,
                                border: `1px solid ${theme.color.border}`,
                                background,
                                color: theme.color.text,
                                cursor: chosen ? 'default' : 'pointer',
                                fontSize: 14,
                            }}
                        >
                            {choice}
                        </button>
                    )
                })}
            </div>
            {chosen !== null && current.explanation && (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: theme.color.textMuted }}>{current.explanation}</p>
            )}
            {chosen !== null && (
                <button style={{ ...primaryButton, marginTop: 12 }} onClick={next}>
                    {index >= questions.length - 1 ? 'Finish' : 'Next'}
                </button>
            )}
        </div>
    )
}

const panelStyle: React.CSSProperties = {
    background: theme.color.surface,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md,
    padding: 16,
}

const primaryButton: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: theme.radius.pill,
    border: 0,
    background: theme.color.primary,
    color: theme.color.onPrimary,
    fontWeight: 600,
    cursor: 'pointer',
}

const dismissButton: React.CSSProperties = {
    background: 'transparent',
    border: 0,
    color: theme.color.textMuted,
    cursor: 'pointer',
    fontSize: 14,
}

export default QuizCard
