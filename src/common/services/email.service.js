import { env } from '../../config/env.js';
import { logger } from '../middleware/requestLogger.js';

const RESEND_API_KEY = env.resend.apiKey;
const FROM = env.resend.from || 'noreply@pinpoint.dev';
const APP_URL = env.auth.appUrl || 'http://localhost:3000';

export class EmailService {
  async send({ to, subject, html }) {
    if (!RESEND_API_KEY) {
      logger.warn('[Email] RESEND_API_KEY not configured — skipping email send');
      return null;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        logger.error({ status: response.status, error: data }, '[Email] Send failed');
        return null;
      }

      logger.info({ to, subject }, '[Email] Sent successfully');
      return data;
    } catch (err) {
      logger.error({ err: err.message }, '[Email] Send error');
      return null;
    }
  }

  buildTemplate(title, bodyHtml, actionUrl, actionText) {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:24px 0">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
        <tr>
          <td style="padding:32px 24px 8px;text-align:center">
            <h1 style="margin:0;font-size:24px;font-weight:700;color:#111827">PinPoint</h1>
            <p style="margin:4px 0 0;font-size:13px;color:#6b7280">Visual Website Feedback</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px">
            <h2 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827">${title}</h2>
            ${bodyHtml}
          </td>
        </tr>
        ${actionUrl && actionText ? `
        <tr>
          <td style="padding:0 24px 24px;text-align:center">
            <a href="${actionUrl}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">${actionText}</a>
          </td>
        </tr>` : ''}
        <tr>
          <td style="padding:16px 24px 24px;border-top:1px solid #e5e7eb">
            <p style="margin:0;font-size:12px;color:#9ca3af">
              PinPoint · <a href="${APP_URL}" style="color:#9ca3af">${APP_URL}</a><br>
              If you don't want to receive these emails, you can <a href="${APP_URL}/dashboard/settings" style="color:#2563eb">turn off notifications</a>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  }

  async sendAssignmentEmail({ toEmail, toName, feedbackTitle, feedbackId, projectId, assignerName }) {
    const url = `${APP_URL}/dashboard/projects/${projectId}/feedback/${feedbackId}`;
    const html = this.buildTemplate(
      'You have been assigned feedback',
      `<p style="margin:0 0 12px;font-size:14px;color:#374151">${assignerName || 'Someone'} assigned you:</p>
       <p style="margin:0 0 12px;font-size:14px;color:#111827;font-weight:500">${feedbackTitle || 'Untitled feedback'}</p>
       <p style="margin:0;font-size:14px;color:#374151">Click the button below to view and respond to this feedback.</p>`,
      url,
      'View Feedback'
    );
    return this.send({ to: toEmail, subject: `[PinPoint] Feedback assigned to you`, html });
  }

  async sendStatusChangeEmail({ toEmail, toName, feedbackTitle, feedbackId, projectId, newStatus, changerName }) {
    const url = `${APP_URL}/dashboard/projects/${projectId}/feedback/${feedbackId}`;
    const html = this.buildTemplate(
      'Feedback status updated',
      `<p style="margin:0 0 12px;font-size:14px;color:#374151">${changerName || 'Someone'} changed the status of:</p>
       <p style="margin:0 0 12px;font-size:14px;color:#111827;font-weight:500">${feedbackTitle || 'Untitled feedback'}</p>
       <p style="margin:0;font-size:14px;color:#374151">New status: <strong>${newStatus}</strong></p>`,
      url,
      'View Feedback'
    );
    return this.send({ to: toEmail, subject: `[PinPoint] Feedback status: ${newStatus}`, html });
  }

  async sendCommentEmail({ toEmail, toName, feedbackTitle, feedbackId, projectId, commentPreview, commenterName }) {
    const url = `${APP_URL}/dashboard/projects/${projectId}/feedback/${feedbackId}`;
    const html = this.buildTemplate(
      'New comment on your feedback',
      `<p style="margin:0 0 12px;font-size:14px;color:#374151">${commenterName || 'Someone'} commented on:</p>
       <p style="margin:0 0 12px;font-size:14px;color:#111827;font-weight:500">${feedbackTitle || 'Untitled feedback'}</p>
       <div style="margin:0 0 12px;padding:12px;background-color:#f3f4f6;border-radius:8px;font-size:13px;color:#374151;border-left:3px solid #2563eb">${commentPreview || ''}</div>`,
      url,
      'View Feedback'
    );
    return this.send({ to: toEmail, subject: `[PinPoint] New comment on feedback`, html });
  }

  async sendPasswordResetEmail({ toEmail, resetToken }) {
    const url = `${APP_URL}/auth/reset-password/${resetToken}`;
    const html = this.buildTemplate(
      'Reset your password',
      `<p style="margin:0 0 12px;font-size:14px;color:#374151">We received a request to reset your password. Click the button below to set a new one. This link expires in 1 hour.</p>
       <p style="margin:0;font-size:14px;color:#374151">If you didn't request this, you can safely ignore this email.</p>`,
      url,
      'Reset Password'
    );
    return this.send({ to: toEmail, subject: `[PinPoint] Reset your password` });
  }
}

export const emailService = new EmailService();
