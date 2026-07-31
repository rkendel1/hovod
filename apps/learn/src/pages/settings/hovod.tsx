import type { NextPage } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { DASHBOARD_PATHS, DEFAULT_PLATFORM_SETTINGS } from '@hovod/contracts'
import type { PlatformSettings } from '@hovod/contracts'

const SettingsPage: NextPage = () => {
    const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [openReelsReady, setOpenReelsReady] = useState<boolean | null>(null)
    const dashboardBaseUrl = (process.env.NEXT_PUBLIC_HOVOD_DASHBOARD_URL || 'http://localhost:3003').replace(/\/$/, '')
    const openReelsUiUrl = process.env.NEXT_PUBLIC_OPENREELS_UI_URL || ''
    const defaultProvider = process.env.NEXT_PUBLIC_OPENREELS_DEFAULT_PROVIDER || process.env.OPENREELS_DEFAULT_PROVIDER || 'google'
    const defaultTts = process.env.NEXT_PUBLIC_OPENREELS_DEFAULT_TTS || process.env.OPENREELS_DEFAULT_TTS || 'elevenlabs'

    const deepLinks = useMemo(
        () => [
            { label: 'Analytics', href: `${dashboardBaseUrl}${DASHBOARD_PATHS.analytics}` },
            { label: 'Members', href: `${dashboardBaseUrl}${DASHBOARD_PATHS.members}` },
            { label: 'API Keys', href: `${dashboardBaseUrl}${DASHBOARD_PATHS.apiKeys}` },
        ],
        [dashboardBaseUrl]
    )

    useEffect(() => {
        fetch('/api/settings')
            .then((response) => response.json())
            .then((payload) => {
                if (payload?.data) setSettings(payload.data)
            })
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => {
        fetch('/api/generate/health')
            .then((response) => response.json())
            .then((payload) => setOpenReelsReady(Boolean(payload?.data?.ok)))
            .catch(() => setOpenReelsReady(false))
    }, [])

    const save = async () => {
        setSaving(true)
        setMessage('')
        const response = await fetch('/api/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
            setSaving(false)
            setMessage(payload?.error || 'Failed to save settings')
            return
        }

        setSettings(payload.data)
        setSaving(false)
        setMessage('Settings saved')
    }

    const onLogoChange = async (file: File) => {
        const response = await fetch('/api/settings/logo', {
            method: 'PUT',
            headers: { 'Content-Type': file.type || 'image/png' },
            body: file,
        })
        const payload = await response.json().catch(() => ({}))
        if (response.ok && payload?.data?.logoUrl) {
            setSettings((current) => ({ ...current, logoUrl: payload.data.logoUrl }))
            return
        }
        setMessage(payload?.error || 'Failed to upload logo')
    }

    const removeLogo = async () => {
        const response = await fetch('/api/settings/logo', { method: 'DELETE' })
        const payload = await response.json().catch(() => ({}))
        if (response.ok) {
            setSettings((current) => ({ ...current, logoUrl: null }))
            return
        }
        setMessage(payload?.error || 'Failed to remove logo')
    }

    return (
        <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 48px', color: '#fff' }}>
            <Head>
                <title>Platform Settings</title>
            </Head>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h1 style={{ margin: 0, fontSize: 22 }}>Platform Settings</h1>
                <Link href="/owner" style={{ color: '#a1a1aa' }}>
                    Back to Studio
                </Link>
            </div>

            {loading ? (
                <p>Loading settings...</p>
            ) : (
                <>
                    <section style={{ background: '#18181b', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                        <h2 style={{ fontSize: 16, marginTop: 0 }}>Branding & defaults</h2>
                        <label style={{ display: 'block', marginBottom: 10 }}>
                            Primary color
                            <input
                                value={settings.primaryColor}
                                onChange={(event) => setSettings((current) => ({ ...current, primaryColor: event.target.value }))}
                                style={{ width: '100%', marginTop: 6, height: 36 }}
                            />
                        </label>

                        <label style={{ display: 'block', marginBottom: 10 }}>
                            Theme
                            <select
                                value={settings.theme}
                                onChange={(event) =>
                                    setSettings((current) => ({
                                        ...current,
                                        theme: event.target.value === 'light' ? 'light' : 'dark',
                                    }))
                                }
                                style={{ width: '100%', marginTop: 6, height: 36 }}
                            >
                                <option value="dark">Dark</option>
                                <option value="light">Light</option>
                            </select>
                        </label>

                        <label style={{ display: 'block', marginBottom: 8 }}>
                            <input
                                type="checkbox"
                                checked={settings.aiAutoTranscribe}
                                onChange={(event) =>
                                    setSettings((current) => ({ ...current, aiAutoTranscribe: event.target.checked }))
                                }
                            />{' '}
                            Auto transcribe
                        </label>
                        <label style={{ display: 'block', marginBottom: 12 }}>
                            <input
                                type="checkbox"
                                checked={settings.aiAutoChapter}
                                onChange={(event) => setSettings((current) => ({ ...current, aiAutoChapter: event.target.checked }))}
                            />{' '}
                            Auto chapter generation
                        </label>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                onChange={(event) => {
                                    const file = event.target.files?.[0]
                                    if (file) onLogoChange(file)
                                    event.target.value = ''
                                }}
                            />
                            {settings.logoUrl && (
                                <button onClick={removeLogo} style={{ height: 30 }}>
                                    Remove logo
                                </button>
                            )}
                        </div>

                        <button onClick={save} disabled={saving} style={{ marginTop: 16, height: 34, padding: '0 14px' }}>
                            {saving ? 'Saving...' : 'Save settings'}
                        </button>
                        {message && <p style={{ marginTop: 8 }}>{message}</p>}
                    </section>

                    <section style={{ background: '#18181b', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                        <h2 style={{ fontSize: 16, marginTop: 0 }}>OpenReels integration</h2>
                        <p style={{ marginTop: 0, color: openReelsReady ? '#86efac' : '#fca5a5' }}>
                            Connection status: {openReelsReady === null ? 'Checking...' : openReelsReady ? 'Connected' : 'Unavailable'}
                        </p>
                        <p style={{ color: '#a1a1aa', margin: '6px 0' }}>Default provider: {defaultProvider}</p>
                        <p style={{ color: '#a1a1aa', margin: '6px 0 12px' }}>Default TTS: {defaultTts}</p>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <Link href="/owner/pipeline" style={{ color: '#fff', background: '#27272a', padding: '8px 12px', borderRadius: 999 }}>
                                Pipeline health
                            </Link>
                            {openReelsUiUrl && (
                                <a
                                    href={openReelsUiUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: '#fff', background: '#27272a', padding: '8px 12px', borderRadius: 999 }}
                                >
                                    Open OpenReels UI
                                </a>
                            )}
                        </div>
                    </section>

                    <section style={{ background: '#18181b', borderRadius: 12, padding: 16 }}>
                        <h2 style={{ fontSize: 16, marginTop: 0 }}>Advanced dashboard sections</h2>
                        <p style={{ color: '#a1a1aa', marginTop: 0 }}>
                            These areas stay in Dashboard, while upload and settings are integrated in Learn.
                        </p>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {deepLinks.map((item) => (
                                <a
                                    key={item.label}
                                    href={item.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: '#fff', background: '#27272a', padding: '8px 12px', borderRadius: 999 }}
                                >
                                    {item.label}
                                </a>
                            ))}
                        </div>
                    </section>
                </>
            )}
        </main>
    )
}

export default SettingsPage
