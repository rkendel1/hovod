import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { SWRConfig } from 'swr'

const fetcher = async (...args: Parameters<typeof fetch>) => {
    const res = await fetch(...args)
    return res.json()
}

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <SWRConfig value={{ fetcher }}>
            <Component {...pageProps} />
        </SWRConfig>
    )
}

export default MyApp
