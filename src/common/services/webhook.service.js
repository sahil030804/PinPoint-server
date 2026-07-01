import { Workspace } from '../../database/models/index.js';
import { logger } from '../middleware/requestLogger.js';

export class WebhookService {
  async getWebhooks(workspaceId) {
    const workspace = await Workspace.findByPk(workspaceId, { attributes: ['theme'] });
    if (!workspace) return [];
    return workspace.theme?.webhooks || [];
  }

  async sendWebhook(event, payload) {
    const workspaceId = payload.workspaceId;
    if (!workspaceId) return;

    const webhooks = await this.getWebhooks(workspaceId);
    const active = webhooks.filter((w) => w.isActive && w.events?.includes(event));

    if (!active.length) return;

    const body = {
      event,
      workspaceId,
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

    for (const webhook of active) {
      fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch((err) => {
        logger.error({ webhookUrl: webhook.url, event, err: err.message }, 'Webhook delivery failed');
      });
    }
  }
}

export const webhookService = new WebhookService();
