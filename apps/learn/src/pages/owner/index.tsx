import type { NextPage } from 'next'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppShell from '../../components/shell/AppShell'
import OwnerGuard from '../../components/shell/OwnerGuard'
import { theme } from '../../lib/theme'
import { useSession } from '../../lib/useSession'

interface Pipeline {
    proposals: { byStatus: Record<string, number>; total: number }
    jobs: { byStatus: Record<string, number>; recentFailures: unknown[] }
    services: { openreels: { reachable: boolean } }
}

const cards = [
    { href: '/owner/proposals', title: 'Proposals', desc: 'Curate bot-discovered ideas and push them into the OpenReels factory.' },
    { href: '/owner/library', title: 'Library', desc: 'Publish, feature, and tag assets. Track views, likes, and comments.' },
    { href: '/owner/quizzes', title: 'Quiz bank', desc: 'Author retention questions attached to each published asset.' },
    { href: '/owner/pipeline', title: 'Pipeline health', desc: 'Generation jobs, failures, and OpenReels service status.' },
]

const OwnerHome: NextPage = () => {
    const { loading, user } = useSession()
    const [pipeline, setPipeline] = useState<Pipeline | null>(null)

    useEffect(() => {
        if (user?.role !== 'owner') return
        fetch('/api/owner/pipeline')
            .then((r) => r.json())
            .then((payload) => setPipeline(payload?.data || null))
            .catch(() => undefined)
    }, [user])

    return (
        <OwnerGuard loading={loading} user={user}>
            <AppShell title="Overview · Hovod Studio" user={user} variant="owner">
                <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>Owner back door</h1>
                <p style={{ margin: '0 0 24px', color: theme.color.textMuted }}>
                    Discover → propose → generate → curate → publish. One pipeline into the consumer feed.
                </p>

                {pipeline && (
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: 12,
                            marginBottom: 24,
                        }}
                    >
                        <Snapshot label="Proposals pending" value={pipeline.proposals.byStatus.pending || 0} />
                        <Snapshot label="Generated" value={pipeline.proposals.byStatus.generated || 0} />
                        <Snapshot label="Job failures" value={pipeline.jobs.recentFailures.length} />
                        <Snapshot
                            label="OpenReels"
                            value={pipeline.services.openreels.reachable ? 'Online' : 'Offline'}
                            tone={pipeline.services.openreels.reachable ? theme.color.success : theme.color.danger}
                        />
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                    {cards.map((card) => (
                        <Link
                            key={card.href}
                            href={card.href}
                            style={{
                                display: 'block',
                                padding: 18,
                                borderRadius: theme.radius.lg,
                                background: theme.color.surface,
                                border: `1px solid ${theme.color.border}`,
                            }}
                        >
                            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{card.title}</div>
                            <div style={{ fontSize: 13, color: theme.color.textMuted }}>{card.desc}</div>
                        </Link>
                    ))}
                </div>
            </AppShell>
        </OwnerGuard>
    )
}

const Snapshot = ({ label, value, tone }: { label: string; value: string | number; tone?: string }) => (
    <div style={{ background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.md, padding: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: tone || theme.color.text }}>{value}</div>
        <div style={{ fontSize: 12, color: theme.color.textMuted, marginTop: 2 }}>{label}</div>
    </div>
)

export default OwnerHome
