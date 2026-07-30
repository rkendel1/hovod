import type { NextPage } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'generated' | 'failed'

interface Proposal {
    id: string
    status: ProposalStatus
    source: {
        type?: string
        title?: string
        url?: string
    }
    summary: string
    keyMessages: string[]
    proposedTitle: string
    scriptOutline: string
    visualDirection: {
        imageryNotes?: string[]
        mood?: string
    }
    categories: string[]
    qualityScore: number
}

const ProposalsPage: NextPage = () => {
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState('')
    const [selected, setSelected] = useState<Proposal | null>(null)
    const [proposals, setProposals] = useState<Proposal[]>([])
    const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('pending')

    const filtered = useMemo(
        () => (statusFilter === 'all' ? proposals : proposals.filter((proposal) => proposal.status === statusFilter)),
        [proposals, statusFilter]
    )

    const loadProposals = async () => {
        setLoading(true)
        const query = statusFilter === 'all' ? '' : `?status=${encodeURIComponent(statusFilter)}`
        const response = await fetch(`/api/proposals${query}`)
        const payload = await response.json().catch(() => ({}))
        setLoading(false)
        if (!response.ok) {
            setMessage(payload?.error || 'Failed to load proposals')
            return
        }
        const next = Array.isArray(payload?.data) ? payload.data : []
        setProposals(next)
        if (next.length > 0) setSelected(next[0])
        else setSelected(null)
    }

    useEffect(() => {
        void loadProposals()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter])

    const act = async (proposalId: string, action: 'approve' | 'reject') => {
        setMessage('')
        const response = await fetch(`/api/proposals/${encodeURIComponent(proposalId)}/${action}`, { method: 'POST' })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
            setMessage(payload?.error || `Failed to ${action} proposal`)
            return
        }
        setMessage(`Proposal ${action}d`)
        await loadProposals()
    }

    const triggerDiscovery = async () => {
        setMessage('')
        const response = await fetch('/api/proposals', { method: 'POST' })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
            setMessage(payload?.error || 'Failed to start discovery')
            return
        }
        setMessage(`Discovery queued (${payload?.data?.jobId || 'ok'})`)
    }

    return (
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24, color: '#fff' }}>
            <Head>
                <title>Proposal Inbox</title>
            </Head>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h1 style={{ margin: 0 }}>Proposal Inbox</h1>
                <Link href="/" style={{ color: '#a1a1aa' }}>
                    Back to feed
                </Link>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ProposalStatus | 'all')}>
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="generated">Generated</option>
                    <option value="failed">Failed</option>
                </select>
                <button onClick={triggerDiscovery}>Trigger discovery</button>
            </div>
            {message && <p>{message}</p>}

            {loading ? (
                <p>Loading proposals...</p>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '330px 1fr', gap: 16 }}>
                    <section style={{ background: '#18181b', borderRadius: 12, padding: 12, maxHeight: 640, overflowY: 'auto' }}>
                        {filtered.map((proposal) => (
                            <button
                                key={proposal.id}
                                onClick={() => setSelected(proposal)}
                                style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    border: 0,
                                    borderRadius: 10,
                                    padding: 10,
                                    marginBottom: 8,
                                    background: selected?.id === proposal.id ? '#27272a' : '#111827',
                                    color: '#fff',
                                    cursor: 'pointer',
                                }}
                            >
                                <div style={{ fontWeight: 600 }}>{proposal.proposedTitle}</div>
                                <div style={{ fontSize: 12, opacity: 0.8 }}>
                                    {proposal.source?.type || 'source'} • {(proposal.qualityScore * 100).toFixed(0)}%
                                </div>
                            </button>
                        ))}
                        {filtered.length === 0 && <p style={{ margin: 0, color: '#a1a1aa' }}>No proposals</p>}
                    </section>

                    <section style={{ background: '#18181b', borderRadius: 12, padding: 16 }}>
                        {!selected ? (
                            <p style={{ margin: 0 }}>Select a proposal</p>
                        ) : (
                            <>
                                <h2 style={{ marginTop: 0 }}>{selected.proposedTitle}</h2>
                                <p style={{ margin: '8px 0', color: '#a1a1aa' }}>{selected.summary}</p>
                                <p style={{ margin: '8px 0' }}>
                                    <strong>Source:</strong> {selected.source?.title || 'Unknown'}{' '}
                                    {selected.source?.url && (
                                        <a href={selected.source.url} target="_blank" rel="noreferrer">
                                            link
                                        </a>
                                    )}
                                </p>
                                <p style={{ margin: '8px 0' }}>
                                    <strong>Categories:</strong> {selected.categories.join(', ') || '—'}
                                </p>
                                <h3>Key messages</h3>
                                <ul>
                                    {selected.keyMessages.map((messageItem) => (
                                        <li key={messageItem}>{messageItem}</li>
                                    ))}
                                </ul>
                                <h3>Script outline</h3>
                                <pre style={{ whiteSpace: 'pre-wrap' }}>{selected.scriptOutline}</pre>
                                <h3>Imagery notes</h3>
                                <ul>
                                    {(selected.visualDirection?.imageryNotes || []).map((note) => (
                                        <li key={note}>{note}</li>
                                    ))}
                                </ul>

                                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                                    <button onClick={() => void act(selected.id, 'approve')} disabled={selected.status !== 'pending'}>
                                        Approve
                                    </button>
                                    <button onClick={() => void act(selected.id, 'reject')} disabled={selected.status !== 'pending'}>
                                        Reject
                                    </button>
                                </div>
                            </>
                        )}
                    </section>
                </div>
            )}
        </main>
    )
}

export default ProposalsPage
