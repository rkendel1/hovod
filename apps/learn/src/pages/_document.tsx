import { Html, Head as DocumentHead, Main, NextScript } from 'next/document'

const MyDocument = () => (
    <Html>
        <DocumentHead>
            <link rel="manifest" href="/manifest.json" />
            <link
                href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;1,400&display=swap"
                rel="stylesheet"
            />
            <link rel="apple-touch-icon" href="/icon.png" />
            <meta name="theme-color" content="#fff" />
        </DocumentHead>
        <body>
            <Main />
            <NextScript />
        </body>
    </Html>
)

export default MyDocument
