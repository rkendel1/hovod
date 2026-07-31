import type { NextPage } from 'next'
import { useEffect, useMemo, useState } from 'react'
import AppShell from '../../components/shell/AppShell'
import OwnerGuard from '../../components/shell/OwnerGuard'
import { statusColor, theme } from '../../lib/theme'
import { useSession } from '../../lib/useSession'

type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'generated' | 'failed'

interface Proposal {
    id: string
    status: ProposalStatus
    source: { type?: string; title?: string; url?: string }
    summary: string
    keyMessages: string[]
    proposedTitle: string
    scriptOutline: string
    visualDirection: { imageryNotes?: string[]; mood?: string }
    categories: string[]
    qualityScore: number
}

const OwnerProposals: NextPage = () => {
    const { loading: sessionLoading, user } = useSession()
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState('')
    const [selected, setSelected] = useState<Proposal | null>(null)
    const [proposals, setProposals] = useState<Proposal[]>([])
    const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('pending')

    const filtered = useMemo(
        () => (statusFilter === 'all' ? proposals : proposals.filter((p) => p.status === statusFilter)),
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
        setSelected(next[0] || null)
    }

    useEffect(() => {
        if (user?.role === 'owner') void loadProposals()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, user])

    const act = async (proposalId: string, action: 'approve' | 'reject') => {
        setMessage('')
        const response = await fetch(`/api/proposals/${encodeURIComponent(proposalId)}/${action}`, { method: 'POST' })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
            setMessage(payload?.error || `Failed to ${action} proposal`)
            return
        }
        setMessage(action === 'approve' ? 'Approved → OpenReels job queued' : 'Proposal rejected')
        await loadProposals()
    }

    const triggerDiscovery = async () => {
        setMessage('')
        const response = await fetch('/api/proposals', { method: 'POST' })
        const payload = await response.json().catch(() => ({}))
        setMessage(response.ok ? `Discovery queued (${payload?.data?.jobId || 'ok'})` : payload?.error || 'Failed to start discovery')
    }

    return (
        <OwnerGuard loading={sessionLoading} user={user}>
            <AppShell title="Proposals · Hovod Studio" user={user} variant="owner">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h1 style={{ margin: 0, fontSize: 24 }}>Proposal inbox</h1>
                </div>
                <p style={{ margin: '0 0 16px', color: theme.color.textMuted, fontSize: 14 }}>
                    Curate bot-discovered ideas. Approving pushes the script + direction into the OpenReels factory.
                </p>

                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as ProposalStatus | 'all')}
                        style={{ padding: '8px 12px', borderRadius: theme.radius.sm, background: theme.color.surface, color: theme.color.text, border: `1px solid ${theme.color.border}` }}
                    >
                        <option value="all">All</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="generated">Generated</option>
                        <option value="failed">Failed</option>
                    </select>
                    <button onClick={triggerDiscovery} style={ghostButton}>Trigger discovery</button>
                    {message && <span style={{ fontSize: 13, color: theme.color.textMuted }}>{message}</span>}
                </div>

                {loading ? (
                    <p style={{ color: theme.color.textMuted }}>Loading proposals…</p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
                        <section style={{ background: theme.color.surface, borderRadius: theme.radius.md, border: `1px solid ${theme.color.border}`, padding: 10, maxHeight: 640, overflowY: 'auto' }}>
                            {filtered.map((proposal) => (
                                <button
                                    key={proposal.id}
                                    onClick={() => setSelected(proposal)}
                                    style={{
                                        width: '100%',
                                        textAlign: 'left',
                                        border: 0,
                                        borderRadius: theme.radius.sm,
                                        padding: 10,
                                        marginBottom: 8,
                                        background: selected?.id === proposal.id ? theme.color.surfaceHover : 'transparent',
                                        color: theme.color.text,
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{proposal.proposedTitle}</div>
                                    <div style={{ fontSize: 12, color: theme.color.textSubtle, display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                                        <span style={{ color: statusColor(proposal.status), fontWeight: 600 }}>{proposal.status}</span>
                                        · {proposal.source?.type || 'source'} · {(proposal.qualityScore * 100).toFixed(0)}%
                                    </div>
                                </button>
                            ))}
                            {filtered.length === 0 && <p style={{ margin: 0, color: theme.color.textMuted, fontSize: 13 }}>No proposals</p>}
                        </section>

                        <section style={{ background: theme.color.surface, borderRadius: theme.radius.md, border: `1px solid ${theme.color.border}`, padding: 16 }}>
                            {!selected ? (
                                <p style={{ margin: 0, color: theme.color.textMuted }}>Select a proposal</p>
                            ) : (
                                <>
                                    <h2 style={{ marginTop: 0 }}>{selected.proposedTitle}</h2>
                                    <p style={{ margin: '8px 0', color: theme.color.textMuted }}>{selected.summary}</p>
                                    <p style={{ margin: '8px 0', fontSize: 14 }}>
                                        <strong>Source:</strong> {selected.source?.title || 'Unknown'}{' '}
                                        {selected.source?.url && (
                                            <a href={selected.source.url} target="_blank" rel="noreferrer" style={{ color: theme.color.primary }}>link</a>
                                        )}
                                    </p>
                                    <p style={{ margin: '8px 0', fontSize: 14 }}>
                                        <strong>Categories:</strong> {selected.categories.join(', ') || '—'}
                                    </p>
                                    <h3 style={{ fontSize: 14 }}>Key messages</h3>
                                    <ul style={{ paddingLeft: 18, color: theme.color.textMuted }}>
                                        {selected.keyMessages.map((m) => <li key={m}>{m}</li>)}
                                    </ul>
                                    <h3 style={{ fontSize: 14 }}>Script outline</h3>
                                    <pre style={{ whiteSpace: 'pre-wrap', background: theme.color.bg, padding: 12, borderRadius: theme.radius.sm, fontSize: 13, color: theme.color.textMuted, overflowX: 'auto' }}>
                                        {selected.scriptOutline}
                                    </pre>
                                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                                        <button onClick={() => act(selected.id, 'approve')} disabled={selected.status !== 'pending'} style={primaryButton}>
                                            Approve → Generate
                                        </button>
                                        <button onClick={() => act(selected.id, 'reject')} disabled={selected.status !== 'pending'} style={ghostButton}>
                                            Reject
                                        </button>
                                    </div>
                                </>
                            )}
                        </section>
                    </div>
                )}
            </AppShell>
        </OwnerGuard>
    )
}

const primaryButton: React.CSSProperties = {
    padding: '9px 16px',
    borderRadius: theme.radius.pill,
    border: 0,
    background: theme.color.primary,
    color: theme.color.onPrimary,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
}
const ghostButton: React.CSSProperties = {
    padding: '9px 16px',
    borderRadius: theme.radius.pill,
    border: `1px solid ${theme.color.border}`,
    background: 'transparent',
    color: theme.color.text,
    fontSize: 13,
    cursor: 'pointer',
}

export default OwnerProposals
