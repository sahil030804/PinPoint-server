import crypto from 'node:crypto';
import { Workspace, WebhookDelivery } from '../../database/models/index.js';
import { env } from '../../config/env.js';
import { logger } from '../middleware/requestLogger.js';

export class WebhookService {
  async getWebhooks(workspaceId) {
    const workspace = await Workspace.findByPk(workspaceId, { attributes: ['theme'] });
    if (!workspace) return [];
    return workspace.theme?.webhooks || [];
  }

  isSlackUrl(url) {
    return url && url.startsWith('https://hooks.slack.com/');
  }

  buildSlackPayload(event, payload) {
    const colors = {
      'feedback.created': '#3B82F6',
      'feedback.updated': '#F59E0B',
      'comment.created': '#10B981',
    };

    const emojis = {
      'feedback.created': '📝',
      'feedback.updated': '🔄',
      'comment.created': '💬',
    };

    const statusEmojis = {
      new: ':new:',
      open: ':open:',
      in_progress: ':in_progress:',
      testing: ':testing:',
      done: ':done:',
      closed: ':closed:',
    };

    const priorityEmojis = {
      critical: ':rotating_light:',
      high: ':warning:',
      medium: ':medium:',
      low: ':low:',
    };

    const feedbackUrl = `${env.auth.appUrl}/dashboard/projects/${payload.projectId || 'all'}/feedback/${payload.feedbackId}`;

    const blocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emojis[event] || '🔔'} *${payload.title || 'Feedback ' + event}*`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Status:*\n${statusEmojis[payload.status] || payload.status}` },
          { type: 'mrkdwn', text: `*Priority:*\n${priorityEmojis[payload.priority] || payload.priority}` },
        ],
      },
    ];

    if (payload.commentPreview) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `> ${payload.commentPreview.slice(0, 300)}` },
      });
    }

    if (payload.pageUrl) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Page:* <${payload.pageUrl}|${payload.pageUrl}>` },
      });
    }

    if (payload.reporterName) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Reported by:* ${payload.reporterName}` },
      });
    }

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in PinPoint' },
          url: feedbackUrl,
          style: 'primary',
        },
      ],
    });

    return {
      text: `${emojis[event] || '🔔'} ${payload.title || event} — ${payload.status || ''}`,
      blocks,
      attachments: [{
        color: colors[event] || '#6B7280',
        ts: Math.floor(Date.now() / 1000),
      }],
    };
  }

  buildGenericPayload(event, payload) {
    return {
      event,
      workspaceId: payload.workspaceId,
      feedback: {
        id: payload.feedbackId,
        title: payload.title,
        comment: payload.commentPreview,
        pageUrl: payload.pageUrl,
        status: payload.status,
        priority: payload.priority,
        reporterName: payload.reporterName,
      },
      timestamp: new Date().toISOString(),
    };
  }

  signPayload(body, url) {
    const secret = env.webhook.secret || 'pinpoint-webhook-secret';
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  async deliver(webhook, event, body, payload) {
    const isSlack = this.isSlackUrl(webhook.url);
    const requestBody = isSlack ? this.buildSlackPayload(event, payload) : body;
    const bodyStr = JSON.stringify(requestBody);
    const signature = this.signPayload(bodyStr, webhook.url);

    let lastError = null;
    let response = null;
    const maxAttempts = 3;
    const delays = [0, 3000, 9000];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (delays[attempt - 1] > 0) {
        await new Promise((r) => setTimeout(r, delays[attempt - 1]));
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      let start;
      try {
        start = Date.now();
        response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'PinPoint-Webhook/1.0',
            'X-PinPoint-Event': event,
            'X-PinPoint-Delivery': crypto.randomUUID(),
            'X-PinPoint-Signature-256': signature,
            'X-PinPoint-Attempt': String(attempt),
          },
          body: bodyStr,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        const durationMs = Date.now() - start;
        const responseText = await response.text().catch(() => '');

        await this.logDelivery({
          workspaceId: payload.workspaceId,
          webhookId: webhook.id,
          webhookUrl: webhook.url,
          event,
          status: response.ok ? 'success' : 'failed',
          responseCode: response.status,
          responseBody: responseText.slice(0, 1000),
          durationMs,
          attempt,
          maxAttempts,
          error: response.ok ? null : `HTTP ${response.status}`,
        });

        if (response.ok) {
          logger.info({ webhookUrl: webhook.url, event, attempt, durationMs, status: response.status }, 'Webhook delivered');
          return { success: true, attempt, status: response.status };
        }

        lastError = `HTTP ${response.status}: ${responseText.slice(0, 200)}`;
      } catch (err) {
        clearTimeout(timeout);
        const durationMs = Date.now() - start;
        lastError = err.name === 'AbortError' ? 'Timeout: 15s' : err.message;

        await this.logDelivery({
          workspaceId: payload.workspaceId,
          webhookId: webhook.id,
          webhookUrl: webhook.url,
          event,
          status: 'failed',
          responseCode: null,
          responseBody: null,
          durationMs,
          attempt,
          maxAttempts,
          error: lastError,
        });

        logger.warn({ webhookUrl: webhook.url, event, attempt, err: lastError }, 'Webhook delivery attempt failed');
      }
    }

    logger.error({ webhookUrl: webhook.url, event, maxAttempts, lastError }, 'Webhook delivery failed after all retries');
    return { success: false, error: lastError };
  }

  async logDelivery({ workspaceId, webhookId, webhookUrl, event, status, responseCode, responseBody, durationMs, attempt, maxAttempts, error }) {
    try {
      await WebhookDelivery.create({
        workspaceId,
        webhookId,
        webhookUrl,
        event,
        status,
        responseCode,
        responseBody,
        durationMs,
        attempt,
        maxAttempts,
        error,
      });
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to log webhook delivery');
    }
  }

  async sendWebhook(event, payload) {
    const workspaceId = payload.workspaceId;
    if (!workspaceId) return;

    const webhooks = await this.getWebhooks(workspaceId);
    const active = webhooks.filter((w) => w.isActive && w.events?.includes(event));

    if (!active.length) return;

    const body = this.buildGenericPayload(event, payload);

    const results = await Promise.allSettled(
      active.map((webhook) => this.deliver(webhook, event, body, payload))
    );

    return results;
  }

  async deliverTest(webhookUrl, workspaceId) {
    const testPayload = {
      workspaceId,
      feedbackId: crypto.randomUUID(),
      title: 'Test Webhook — PinPoint Ping',
      commentPreview: 'This is a test message to verify your webhook is configured correctly.',
      pageUrl: 'https://pinpoint.dev',
      status: 'new',
      priority: 'medium',
      reporterName: 'PinPoint Webhook Test',
    };

    const body = this.buildGenericPayload('ping', testPayload);

    const mockWebhook = {
      id: crypto.randomUUID(),
      url: webhookUrl,
    };

    const result = await this.deliver(mockWebhook, 'ping', body, testPayload);
    return result;
  }
}

export const webhookService = new WebhookService();
