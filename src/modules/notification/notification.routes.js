import { Router } from 'express';
import { Notification } from '../../database/models/index.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { success } from '../../common/utils/response.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { NotFoundError } from '../../common/errors/AppError.js';

const router = Router();
router.use(authenticate);

// List user notifications
router.get('/', asyncHandler(async (req, res) => {
  const notifications = await Notification.findAll({
    where: { userId: req.user.id },
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
  res.json(success(notifications));
}));

// Mark as read
router.patch('/:id/read', asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    where: { id: req.params.id, userId: req.user.id },
  });
  if (!notification) throw new NotFoundError('Notification not found');
  await notification.update({ isRead: true });
  res.json(success(notification));
}));

// Mark all as read
router.patch('/read-all', asyncHandler(async (req, res) => {
  await Notification.update(
    { isRead: true },
    { where: { userId: req.user.id, isRead: false } }
  );
  res.json(success({ updated: true }));
}));

export { router as notificationRoutes };
