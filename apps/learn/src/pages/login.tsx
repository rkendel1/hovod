import type { GetServerSideProps, NextPage } from 'next'
import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { readSession } from '../lib/server/auth'

const LoginPage: NextPage = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setLoading(true)
        setError('')

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
    }

    return (
        <main style={{ maxWidth: 460, margin: '0 auto', padding: '40px 16px', color: '#fff' }}>
            <h1 style={{ marginTop: 0 }}>Log in</h1>
            <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
                <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
                <button type="submit" disabled={loading}>{loading ? 'Signing in...' : 'Log in'}</button>
            </form>
            {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
            <p style={{ color: '#a1a1aa' }}>
                New here? <Link href="/signup">Create an account</Link>
            </p>
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
