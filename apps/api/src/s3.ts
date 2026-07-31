import { PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from './env.js';

const s3Config = {
  region: env.S3_REGION,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  // MinIO can reject optional checksum headers added by newer AWS SDK defaults.
  // Restrict checksum behavior to operations where checksums are strictly required.
  requestChecksumCalculation: 'WHEN_REQUIRED' as const,
  responseChecksumValidation: 'WHEN_REQUIRED' as const,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY
  }
};

// Internal client for server-side operations (uses Docker-internal endpoint)
export const s3Client = new S3Client({ ...s3Config, endpoint: env.S3_ENDPOINT });

// Public client for generating presigned URLs the browser can reach
export const s3PublicClient = new S3Client({
  ...s3Config,
  endpoint: env.S3_PUBLIC_ENDPOINT || env.S3_ENDPOINT
});

export interface BucketConfigResult {
  configured: boolean;
  reason?: string;
}

/**
 * Auto-configure S3 bucket CORS on startup.
 * Idempotent — safe to call on every boot.
 * Public read is handled per-object via ACL: 'public-read' in the worker.
 */
export async function configureBucket(): Promise<BucketConfigResult> {
  try {
    await s3Client.send(new PutBucketCorsCommand({
      Bucket: env.S3_BUCKET,
      CORSConfiguration: {
        CORSRules: [{
          AllowedOrigins: ['*'],
          AllowedMethods: ['GET', 'HEAD', 'PUT'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 86400,
        }],
      },
    }));
    return { configured: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const lower = message.toLowerCase();
    if (lower.includes('functionality that is not implemented') || lower.includes('notimplemented')) {
      return {
        configured: false,
        reason: 'S3 provider does not support PutBucketCors headers; skipping auto CORS setup.'
      };
    }
    throw err;
  }
}
