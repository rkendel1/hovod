import type { GetServerSideProps } from 'next'

/** Preferences were merged into /settings. */
export const getServerSideProps: GetServerSideProps = async () => ({
    redirect: { destination: '/settings', permanent: false },
})

const PreferencesRedirect = () => null

export default PreferencesRedirect
