import type { NextPage } from 'next'
import { useCallback, useEffect, useState } from 'react'
import AppShell from '../../components/shell/AppShell'
import OwnerGuard from '../../components/shell/OwnerGuard'
import { statusColor, theme } from '../../lib/theme'
import { useSession } from '../../lib/useSession'

interface Pipeline {
    proposals: { byStatus: Record<string, number>; total: number }
    jobs: {
        byStatus: Record<string, number>
        recentFailures: { id: string; assetId: string; type: string; errorMessage: string | null }[]
    }
    services: { openreels: { reachable: boolean; error?: string } }
}

const OwnerPipeline: NextPage = () => {
    const { loading, user } = useSession()
    const [data, setData] = useState<Pipeline | null>(null)

    const load = useCallback(() => {
        fetch('/api/owner/pipeline')
            .then((r) => r.json())
            .then((payload) => setData(payload?.data || null))
            .catch(() => undefined)
    }, [])

    useEffect(() => {
        if (user?.role === 'owner') load()
    }, [user, load])

    return (
        <OwnerGuard loading={loading} user={user}>
            <AppShell title="Pipeline · Hovod Studio" user={user} variant="owner">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h1 style={{ margin: 0, fontSize: 24 }}>Pipeline health</h1>
                    <button onClick={load} style={ghostButton}>Refresh</button>
                </div>

                {!data ? (
                    <p style={{ color: theme.color.textMuted }}>Loading…</p>
                ) : (
                    <div style={{ display: 'grid', gap: 20 }}>
                        <Panel title="OpenReels service">
                            <span style={{ color: data.services.openreels.reachable ? theme.color.success : theme.color.danger, fontWeight: 600 }}>
                                {data.services.openreels.reachable ? 'Online' : 'Offline'}
                            </span>
                            {data.services.openreels.error && (
                                <span style={{ color: theme.color.textMuted, fontSize: 13, marginLeft: 8 }}>({data.services.openreels.error})</span>
                            )}
                        </Panel>

                        <Panel title="Proposals">
                            <StatusRow byStatus={data.proposals.byStatus} total={data.proposals.total} />
                        </Panel>

                        <Panel title="Generation jobs">
                            <StatusRow byStatus={data.jobs.byStatus} />
                            {data.jobs.recentFailures.length > 0 && (
                                <div style={{ marginTop: 12 }}>
                                    <div style={{ fontSize: 13, color: theme.color.danger, marginBottom: 6 }}>Recent failures</div>
                                    <ul style={{ listStyle: 'none', display: 'grid', gap: 6 }}>
                                        {data.jobs.recentFailures.map((failure) => (
                                            <li key={failure.id} style={{ fontSize: 13, color: theme.color.textMuted }}>
                                                <code style={{ color: theme.color.text }}>{failure.type}</code> · {failure.assetId} —{' '}
                                                {failure.errorMessage || 'unknown error'}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </Panel>
                    </div>
                )}
            </AppShell>
        </OwnerGuard>
    )
}

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section style={{ background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: 16 }}>
        <h2 style={{ fontSize: 15, margin: '0 0 10px' }}>{title}</h2>
        {children}
    </section>
)

const StatusRow = ({ byStatus, total }: { byStatus: Record<string, number>; total?: number }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {Object.entries(byStatus).length === 0 && <span style={{ color: theme.color.textMuted, fontSize: 13 }}>None</span>}
        {Object.entries(byStatus).map(([status, count]) => (
            <span key={status} style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: theme.radius.pill, background: `${statusColor(status)}22`, color: statusColor(status) }}>
                {status}: {count}
            </span>
        ))}
        {typeof total === 'number' && <span style={{ fontSize: 12, color: theme.color.textSubtle, alignSelf: 'center' }}>total {total}</span>}
    </div>
)

const ghostButton: React.CSSProperties = {
    padding: '7px 14px',
    borderRadius: theme.radius.pill,
    border: `1px solid ${theme.color.border}`,
    background: 'transparent',
    color: theme.color.text,
    fontSize: 13,
    cursor: 'pointer',
}

export default OwnerPipeline
