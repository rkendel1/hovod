import { DASHBOARD_PATHS } from '@hovod/contracts'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import styles from './generateShort.module.css'

type GenerateStatus = 'idle' | 'running' | 'done' | 'error'

interface GenerateShortProps {
    onPublished: () => void
}

interface GenerateStatusResponse {
    jobId: string
    status: string
    progress: number | null
    stage: string | null
    hovodAssetId: string | null
    error: string | null
}

const POLL_INTERVAL_MS = 3000

const GenerateShort = ({ onPublished }: GenerateShortProps) => {
    const [topic, setTopic] = useState('')
    const [provider, setProvider] = useState(process.env.NEXT_PUBLIC_OPENREELS_DEFAULT_PROVIDER || 'google')
    const [jobId, setJobId] = useState<string | null>(null)
    const [status, setStatus] = useState<GenerateStatus>('idle')
    const [progress, setProgress] = useState<number | null>(null)
    const [stage, setStage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [hovodAssetId, setHovodAssetId] = useState<string | null>(null)

    const dashboardBaseUrl = useMemo(
        () => (process.env.NEXT_PUBLIC_HOVOD_DASHBOARD_URL || 'http://localhost:3003').replace(/\/$/, ''),
        []
    )

    useEffect(() => {
        if (status !== 'running' || !jobId) return

        const timer = window.setInterval(async () => {
            try {
                const response = await fetch(`/api/generate/${encodeURIComponent(jobId)}`)
                const payload = (await response.json()) as GenerateStatusResponse & { error?: string }

                if (!response.ok) {
                    setStatus('error')
                    setError(payload.error || 'Failed to read generation status')
                    return
                }

                setProgress(typeof payload.progress === 'number' ? payload.progress : null)
                setStage(payload.stage || null)

                const jobStatus = payload.status?.toLowerCase?.() || ''
                const failed = jobStatus === 'failed' || jobStatus === 'error' || jobStatus === 'cancelled'
                const completed = jobStatus === 'completed' || jobStatus === 'done' || jobStatus === 'success'

                if (failed) {
                    setStatus('error')
                    setError(payload.error || 'Generation failed')
                    return
                }

                if (completed && payload.hovodAssetId) {
                    setHovodAssetId(payload.hovodAssetId)
                    setStage('Published to library')
                    setStatus('done')
                    onPublished()
                    return
                }

                if (completed) {
                    setStage('Generated. Publishing to Hovod...')
                }
            } catch {
                setStatus('error')
                setError('Lost connection while polling generation status')
            }
        }, POLL_INTERVAL_MS)

        return () => window.clearInterval(timer)
    }, [jobId, onPublished, status])

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        const trimmedTopic = topic.trim()
        if (!trimmedTopic) {
            setStatus('error')
            setError('Topic is required')
            return
        }

        setStatus('running')
        setError(null)
        setStage('Starting generation...')
        setProgress(null)
        setHovodAssetId(null)

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: trimmedTopic, provider }),
            })

            const payload = (await response.json()) as { jobId?: string; error?: string }
            if (!response.ok || !payload.jobId) {
                throw new Error(payload.error || 'Failed to create generation job')
            }

            setJobId(payload.jobId)
            setStage('Generating...')
        } catch (submitError) {
            setStatus('error')
            setError((submitError as Error).message || 'Generation failed to start')
        }
    }

    return (
        <section id="generate-short" className={styles.generate}>
            <h2 className={styles.title}>Generate short</h2>
            <form onSubmit={onSubmit} className={styles.form}>
                <input
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    placeholder="Topic"
                    className={styles.input}
                    disabled={status === 'running'}
                />
                <input
                    value={provider}
                    onChange={(event) => setProvider(event.target.value)}
                    placeholder="Provider (optional)"
                    className={styles.input}
                    disabled={status === 'running'}
                />
                <button type="submit" className={styles.button} disabled={status === 'running'}>
                    {status === 'running' ? 'Generating...' : 'Generate short'}
                </button>
            </form>

            {jobId && <p className={styles.meta}>Job: {jobId}</p>}
            {stage && <p className={styles.meta}>{stage}</p>}
            {typeof progress === 'number' && <p className={styles.meta}>Progress: {Math.round(progress)}%</p>}
            {error && <p className={styles.error}>{error}</p>}

            {status === 'done' && hovodAssetId && (
                <p className={styles.success}>
                    Published to library.{' '}
                    <a href={`${dashboardBaseUrl}${DASHBOARD_PATHS.videos}`} target="_blank" rel="noreferrer">
                        Open in dashboard
                    </a>
                </p>
            )}
        </section>
    )
}

export default GenerateShort
