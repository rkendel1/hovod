import type { GetServerSideProps } from 'next'

/** Proposals moved under the owner back door. */
export const getServerSideProps: GetServerSideProps = async () => ({
    redirect: { destination: '/owner/proposals', permanent: false },
})

const ProposalsRedirect = () => null

export default ProposalsRedirect
