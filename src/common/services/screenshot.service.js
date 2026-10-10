import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { env } from '../../config/env.js';
import { logger } from '../middleware/requestLogger.js';

const isConfigured = !!(env.storage.endpoint && env.storage.accessKeyId && env.storage.secretAccessKey && env.storage.bucket);
const isDev = env.isDev;

let client = null;
if (isConfigured) {
  client = new S3Client({
    endpoint: env.storage.endpoint,
    region: env.storage.region,
    credentials: {
      accessKeyId: env.storage.accessKeyId,
      secretAccessKey: env.storage.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

export class ScreenshotService {
  async uploadScreenshot(base64DataUrl, workspaceId, feedbackId) {
    if (!client) {
      logger.warn('[Storage] S3 client not configured — skipping upload');
      return null;
    }

    if (!base64DataUrl || typeof base64DataUrl !== 'string') {
      return null;
    }

    const match = base64DataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!match) {
      logger.warn('[Storage] Invalid data URL format');
      return null;
    }

    const format = match[1] === 'jpeg' ? 'jpg' : match[1];
    const base64Data = match[2];
    let buffer;

    try {
      buffer = Buffer.from(base64Data, 'base64');
    } catch {
      logger.warn('[Storage] Failed to decode base64 data');
      return null;
    }

    try {
      // WebP at 75 keep screenshots ~3x smaller than JPEG@80 at 1920px,
      // which stretches the free-tier storage/egress budget considerably.
      const optimized = await sharp(buffer)
        .resize(1600, undefined, { withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();

      const key = `screenshots/${workspaceId}/${feedbackId}.webp`;

      await client.send(new PutObjectCommand({
        Bucket: env.storage.bucket,
        Key: key,
        Body: optimized,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000',
      }));

      logger.info({ key, size: optimized.length }, '[Storage] Screenshot uploaded successfully');

      const url = env.storage.publicUrl
        ? `${env.storage.publicUrl.replace(/\/$/, '')}/${key}`
        : `${env.storage.endpoint.replace(/\/$/, '')}/${env.storage.bucket}/${key}`;

      return url;
    } catch (err) {
      logger.error({ err: err.message }, '[Storage] Screenshot upload failed');
      return null;
    }
  }
}

export const screenshotService = new ScreenshotService();
