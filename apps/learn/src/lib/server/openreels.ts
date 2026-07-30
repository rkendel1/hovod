const API_BASE_FALLBACK = 'http://openreels-api:3000'

export interface OpenReelsJob {
    id: string
    status: string
    progress: number | null
    stage: string | null
    topic: string | null
    outputPath: string | null
    error: string | null
    raw: unknown
}

const asObject = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object') return null
    return value as Record<string, unknown>
}

const readString = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)

const readNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

const readNestedString = (obj: Record<string, unknown> | null, key: string): string | null =>
    obj && key in obj ? readString(obj[key]) : null

const readNestedObject = (obj: Record<string, unknown> | null, key: string): Record<string, unknown> | null =>
    obj ? asObject(obj[key]) : null

export const getOpenReelsApiUrl = () => (process.env.OPENREELS_API_URL || API_BASE_FALLBACK).replace(/\/$/, '')

export const openReelsJson = async (path: string, init?: RequestInit): Promise<unknown> => {
    const response = await fetch(`${getOpenReelsApiUrl()}${path}`, init)
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
        throw new Error((payload as { error?: string })?.error || `OpenReels request failed: ${response.status}`)
    }

    return payload
}

export const normalizeOpenReelsJob = (payload: unknown): OpenReelsJob => {
    const root = asObject(payload)
    const data = asObject(root?.data) || root
    const input = readNestedObject(data, 'input')
    const output = readNestedObject(data, 'output')

    const id = readString(data?.id)
    if (!id) throw new Error('OpenReels response missing job id')

    const status =
        readString(data?.status) || readString(data?.state) || readString(data?.jobStatus) || 'unknown'

    const progress =
        readNumber(data?.progress) ||
        readNumber(data?.percent) ||
        readNumber(data?.percentage) ||
        readNumber(data?.progressPct) ||
        null

    const stage =
        readString(data?.stage) || readString(data?.step) || readString(data?.currentStep) || readString(data?.phase) || null

    const topic = readString(data?.topic) || readNestedString(input, 'topic')

    const outputPath =
        readString(data?.outputPath) ||
        readString(data?.finalPath) ||
        readNestedString(output, 'path') ||
        readNestedString(output, 'finalPath') ||
        null

    const error =
        readString(data?.error) || readString(data?.errorMessage) || readString(data?.message) || null

    return {
        id,
        status,
        progress,
        stage,
        topic,
        outputPath,
        error,
        raw: payload,
    }
}
