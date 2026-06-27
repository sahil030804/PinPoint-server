import { Router } from 'express';
import { sequelize } from '../../database/models/index.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success } from '../../common/utils/response.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { requireWorkspaceAccess } from '../../common/middleware/authorizeWorkspace.js';

const router = Router();
router.use(authenticate);

// Dashboard overview stats
router.get('/overview/:workspaceId', requireWorkspaceAccess, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;

  const [stats] = await sequelize.query(`
    SELECT
      COUNT(*)::int AS "totalFeedback",
      COUNT(*) FILTER (WHERE status = 'new' OR status = 'open')::int AS "open",
      COUNT(*) FILTER (WHERE status = 'done' OR status = 'closed')::int AS "resolved",
      COUNT(*) FILTER (WHERE status = 'in_progress')::int AS "inProgress",
      COUNT(*) FILTER (WHERE priority = 'critical')::int AS "critical"
    FROM feedback f
    JOIN websites w ON f.website_id = w.id
    JOIN projects p ON w.project_id = p.id
    WHERE p.workspace_id = :workspaceId
  `, { replacements: { workspaceId }, type: sequelize.QueryTypes.SELECT });

  res.json(success(stats));
}));

// Feedback trend (daily)
router.get('/trends/:workspaceId', requireWorkspaceAccess, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;
  const days = parseInt(req.query.days, 10) || 30;

  const [trends] = await sequelize.query(`
    SELECT DATE(f.created_at) AS day, COUNT(*)::int AS count
    FROM feedback f
    JOIN websites w ON f.website_id = w.id
    JOIN projects p ON w.project_id = p.id
    WHERE p.workspace_id = :workspaceId
      AND f.created_at >= NOW() - INTERVAL '1 day' * :days
    GROUP BY DATE(f.created_at)
    ORDER BY day ASC
  `, { replacements: { workspaceId, days } });

  res.json(success(trends));
}));

// Recent activity
router.get('/activity/:workspaceId', requireWorkspaceAccess, asyncHandler(async (req, res) => {
  const { workspaceId } = req.params;

  const [rawActivities] = await sequelize.query(`
    SELECT
      al.id, al.action, al.metadata, al.created_at,
      u.name AS actor_name, u.avatar_url AS actor_avatar,
      f.id AS feedback_id, f.title AS feedback_title, f.page_url,
      assignee.name AS assignee_name
    FROM activity_logs al
    JOIN feedback f ON al.feedback_id = f.id
    JOIN websites w ON f.website_id = w.id
    JOIN projects p ON w.project_id = p.id
    LEFT JOIN users u ON al.actor_id = u.id
    LEFT JOIN users assignee ON assignee.id::text = al.metadata->>'to'
    WHERE p.workspace_id = :workspaceId
    ORDER BY al.created_at DESC
    LIMIT 20
  `, { replacements: { workspaceId } });

  const activities = rawActivities.map((a) => ({
    ...a,
    metadata: typeof a.metadata === 'string' ? JSON.parse(a.metadata) : a.metadata,
  }));

  res.json(success(activities));
}));

export { router as analyticsRoutes };
