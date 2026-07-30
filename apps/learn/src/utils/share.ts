export const onShare = async () => {
    const title = 'Hovod Learn'
    const url = window.document.location.href
    const text = 'Take a look at this TikTok-style app powered by Hovod'

    if (navigator.share) {
        try {
            await navigator.share({
                title,
                url,
                text,
            })
        } catch (err) {
            console.warn(err)
        }
    } else {
        alert('Use this application on a mobile device')
    }
}
