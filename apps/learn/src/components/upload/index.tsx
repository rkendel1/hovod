import React, { FC, useEffect, useRef, useState } from 'react'
import styles from './upload.module.css'
import { RiAddFill } from 'react-icons/ri'

interface IUploadProps {
    mutate: () => void
}

const Upload: FC<IUploadProps> = ({ mutate }): JSX.Element => {
    const [progress, setProgress] = useState<number>(0)
    const [isUploading, setIsUploading] = useState<boolean>(false)
    const [videoId, setVideoId] = useState<string | null>(null)
    const [ready, setReady] = useState<boolean>(false)
    const [isProcessing, setIsProcessing] = useState<boolean>(false)
    const [interId, setInterId] = useState<number | undefined>(undefined)

    useEffect(() => {
        if (videoId) {
            const intervalId = window.setInterval(() => {
                fetchVideoStatus(videoId)
            }, 1500)
            setInterId(intervalId)
            return () => clearInterval(intervalId)
        }
    }, [videoId, ready])

    useEffect(() => {
        if (ready && interId) window.clearInterval(interId)
    }, [interId, ready])

    const inputFile = useRef<HTMLInputElement | null>(null)

    const openFilePicker = () => {
        setVideoId(null)
        setReady(false)
        setInterId(undefined)
        setProgress(0)
        !isUploading && inputFile?.current?.click()
    }

    const uploadToSignedUrl = (url: string, file: File) =>
        new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest()
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    setProgress(Math.round((event.loaded * 100) / event.total))
                }
            }
            xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed')))
            xhr.onerror = () => reject(new Error('Upload failed'))
            xhr.open('PUT', url)
            xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
            xhr.send(file)
        })

    const callApi = async (method: string, body: Record<string, unknown>) => {
        const response = await fetch(`/api/videos?method=${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            const payload = await response.json().catch(() => ({}))
            throw new Error(payload?.error || `Request failed: ${method}`)
        }

        return response.json()
    }

    const fileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const { files } = e.target
        if (!files?.length) return

        const file = files[0]
        setIsUploading(true)
        setIsProcessing(false)

        try {
            const created = await callApi('create', { title: file.name })
            const createdVideoId = created?.data?.videoId as string
            setVideoId(createdVideoId)

            const uploadUrlResponse = await callApi('upload-url', { videoId: createdVideoId })
            await uploadToSignedUrl(uploadUrlResponse?.data?.uploadUrl, file)

            await callApi('upload-complete', { videoId: createdVideoId })
            setIsUploading(false)
            setIsProcessing(true)
            await callApi('process', { videoId: createdVideoId })
        } catch (err) {
            console.error(err)
            setIsUploading(false)
            setIsProcessing(false)
        }
    }

    const fetchVideoStatus = async (id: string): Promise<void> => {
        const data = await fetch(`api/videos/${id}`)
        const status = await data.json()

        if (status.status === 'ready') {
            setIsProcessing(false)
            setReady(true)
            mutate()
            setTimeout(() => {
                scrollTo(id)
            }, 1500)
        }
    }

    const scrollTo = (id: string) => {
        const sections = document.querySelector(`#${id}`)
        return sections?.scrollIntoView(true)
    }

    return (
        <div className={styles.upload} onClick={openFilePicker}>
            {isUploading && (
                <>
                    <p className={styles.upload__label}>Uploading...</p>
                    <div className={styles.upload__progress}>
                        <span className={styles.upload__progressbar} style={{ width: `${progress}%` }}></span>
                    </div>
                </>
            )}
            {!isUploading && isProcessing && <p className={styles.upload__label}>Processing...</p>}
            {!isUploading && !isProcessing && (
                <>
                    <div className={styles.addIcon__wrapper}>
                        <RiAddFill size={20} color={'#111111'} />
                    </div>
                    <input
                        type="file"
                        id="upload"
                        ref={inputFile}
                        name="upload"
                        accept="video/*"
                        onChange={(event) => fileInputChange(event)}
                        style={{ display: 'none' }}
                    />
                </>
            )}
        </div>
    )
}

export default Upload
