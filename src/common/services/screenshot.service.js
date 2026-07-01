import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { env } from '../../config/env.js';
import { logger } from '../middleware/requestLogger.js';

const isConfigured = !!(env.r2.endpoint && env.r2.accessKeyId && env.r2.secretAccessKey && env.r2.bucket);

let client = null;
if (isConfigured) {
  client = new S3Client({
    endpoint: env.r2.endpoint,
    region: 'auto',
    credentials: {
      accessKeyId: env.r2.accessKeyId,
      secretAccessKey: env.r2.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

export class ScreenshotService {
  async uploadScreenshot(base64DataUrl, workspaceId, feedbackId) {
    if (!client) {
      logger.warn('[R2] S3 client not configured — skipping upload');
      return null;
    }

    if (!base64DataUrl || typeof base64DataUrl !== 'string') {
      return null;
    }

    const match = base64DataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
    if (!match) {
      logger.warn('[R2] Invalid data URL format');
      return null;
    }

    const format = match[1] === 'jpeg' ? 'jpg' : match[1];
    const base64Data = match[2];
    let buffer;

    try {
      buffer = Buffer.from(base64Data, 'base64');
    } catch {
      logger.warn('[R2] Failed to decode base64 data');
      return null;
    }

    try {
      const optimized = await sharp(buffer)
        .resize(1920, undefined, { withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      const key = `screenshots/${workspaceId}/${feedbackId}.jpg`;

      await client.send(new PutObjectCommand({
        Bucket: env.r2.bucket,
        Key: key,
        Body: optimized,
        ContentType: 'image/jpeg',
        CacheControl: 'public, max-age=31536000',
      }));

      logger.info({ key, size: optimized.length }, '[R2] Screenshot uploaded successfully');

      const url = env.r2.publicUrl
        ? `${env.r2.publicUrl.replace(/\/$/, '')}/${key}`
        : `${env.r2.endpoint.replace(/\/$/, '')}/${env.r2.bucket}/${key}`;

      return url;
    } catch (err) {
      logger.error({ err: err.message }, '[R2] Screenshot upload failed');
      return null;
    }
  }
}

export const screenshotService = new ScreenshotService();
