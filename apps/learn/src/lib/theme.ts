/**
 * Design tokens mirrored from styles/globals.css for use in inline styles.
 * Prefer the CSS variables where possible; this object is for TS-driven styles.
 */
export const theme = {
    color: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        surfaceRaised: 'var(--color-surface-raised)',
        surfaceHover: 'var(--color-surface-hover)',
        border: 'var(--color-border)',
        borderStrong: 'var(--color-border-strong)',
        text: 'var(--color-text)',
        textMuted: 'var(--color-text-muted)',
        textSubtle: 'var(--color-text-subtle)',
        primary: 'var(--color-primary)',
        primaryHover: 'var(--color-primary-hover)',
        onPrimary: 'var(--color-on-primary)',
        accent: 'var(--color-accent)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        focus: 'var(--color-focus)',
    },
    radius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
    },
    shadow: {
        md: 'var(--shadow-md)',
    },
} as const

/** Status → semantic color for published/asset/proposal badges. */
export const statusColor = (status: string): string => {
    switch (status) {
        case 'published':
        case 'ready':
        case 'generated':
        case 'completed':
            return theme.color.success
        case 'processing':
        case 'queued':
        case 'approved':
        case 'pending':
            return theme.color.warning
        case 'error':
        case 'failed':
        case 'rejected':
            return theme.color.danger
        case 'archived':
        case 'unpublished':
        case 'draft':
        default:
            return theme.color.textSubtle
    }
}
