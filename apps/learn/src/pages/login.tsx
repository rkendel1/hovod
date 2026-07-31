import type { GetServerSideProps, NextPage } from 'next'
import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { readSession } from '../lib/server/auth'

const ownerSignInBaseUrl = (process.env.NEXT_PUBLIC_OWNER_SIGNIN_BASE_URL || 'https://hovod.fly.dev').replace(/\/$/, '')

const LoginPage: NextPage = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setLoading(true)
        setError('')

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })
            const payload = await response.json().catch(() => ({})) as { error?: string }

            setLoading(false)
            if (!response.ok) {
                setError(payload.error || 'Login failed')
                return
            }

            window.location.href = '/'
        } catch {
            setLoading(false)
            setError('Unable to reach the server. Please try again.')
        }
    }

    return (
        <main style={{ maxWidth: 460, margin: '0 auto', padding: '40px 16px', color: '#fff', minHeight: '100dvh', display: 'grid', alignContent: 'start' }}>
            <section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 24, boxShadow: 'var(--shadow-md)' }}>
                <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: '3.8rem', lineHeight: 1.1 }}>Log in</h1>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>Welcome back to your learning stream.</p>
                <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
                    <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        type="email"
                        required
                        style={{ borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', padding: '10px 12px' }}
                    />
                    <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        type="password"
                        required
                        style={{ borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', padding: '10px 12px' }}
                    />
                    <button type="submit" disabled={loading} style={{ border: 0, borderRadius: 'var(--radius-pill)', background: 'var(--color-primary)', color: 'var(--color-on-primary)', padding: '10px 14px', fontSize: '2.2rem', cursor: loading ? 'wait' : 'pointer' }}>
                        {loading ? 'Signing in...' : 'Log in'}
                    </button>
                </form>
                {error && <p style={{ color: '#fca5a5', marginTop: 12 }}>{error}</p>}
                <p style={{ color: '#a1a1aa', marginTop: 10 }}>
                    New here? <Link href="/signup" style={{ color: '#fff' }}>Create an account</Link>
                </p>
                <p style={{ color: '#a1a1aa', marginTop: 6 }}>
                    Owner sign in: <a href={`${ownerSignInBaseUrl}/login`} style={{ color: '#fff' }}>{ownerSignInBaseUrl}</a>
                </p>
            </section>
        </main>
    )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
    const session = await readSession(context)
    if (session) {
        return { redirect: { destination: '/', permanent: false } }
    }

    return { props: {} }
}

export default LoginPage
