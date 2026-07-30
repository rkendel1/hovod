import type { NextPage } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'

const DEFAULT_DASHBOARD_PATH = 'videos/new'

const DashboardPage: NextPage = () => {
    const { query } = useRouter()
    const pathSegments = Array.isArray(query.path) ? query.path : []
    const path = pathSegments.length ? pathSegments.join('/') : DEFAULT_DASHBOARD_PATH
    const configuredBaseUrl = process.env.NEXT_PUBLIC_HOVOD_DASHBOARD_URL || 'http://localhost:3003'
    const normalizedBaseUrl = configuredBaseUrl.replace(/\/$/, '')
    const sanitizedPath = path.replace(/^\/+/, '')
    const src = `${normalizedBaseUrl}/${sanitizedPath}`

    return (
        <>
            <Head>
                <title>Hovod Dashboard</title>
            </Head>
            <iframe
                title="Hovod Dashboard"
                src={src}
                style={{ width: '100vw', height: '100vh', border: 0 }}
                referrerPolicy="strict-origin-when-cross-origin"
            />
        </>
    )
}

export default DashboardPage
