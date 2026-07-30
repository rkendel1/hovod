import type { NextPage } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Upload from '../components/upload'

const UploadPage: NextPage = () => {
    const router = useRouter()

    return (
        <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 48px', color: '#fff' }}>
            <Head>
                <title>Upload Video</title>
            </Head>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h1 style={{ margin: 0, fontSize: 22 }}>Upload Video</h1>
                <Link href="/" style={{ color: '#a1a1aa' }}>
                    Back to feed
                </Link>
            </div>

            <p style={{ color: '#a1a1aa', marginBottom: 12 }}>
                Upload stays native in Learn via Next.js API routes and Hovod backend contracts.
            </p>

            <div style={{ position: 'relative', height: 84 }}>
                <Upload mutate={() => router.push('/')} />
            </div>
        </main>
    )
}

export default UploadPage
