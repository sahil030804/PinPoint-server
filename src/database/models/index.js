import { sequelize } from '../../config/database.js';
import { initWorkspaceModel } from './Workspace.model.js';
import { initUserModel } from './User.model.js';
import { initWorkspaceMemberModel } from './WorkspaceMember.model.js';
import { initProjectModel } from './Project.model.js';
import { initWebsiteModel } from './Website.model.js';
import { initFeedbackModel } from './Feedback.model.js';
import { initActivityLogModel } from './ActivityLog.model.js';
import { initCommentModel } from './Comment.model.js';
import { initNotificationModel } from './Notification.model.js';
import { initApiKeyModel } from './ApiKey.model.js';
import { initInvitationModel } from './Invitation.model.js';
import { initWebhookDeliveryModel } from './WebhookDelivery.model.js';

// Initialize all models
const Workspace = initWorkspaceModel(sequelize);
const User = initUserModel(sequelize);
const WorkspaceMember = initWorkspaceMemberModel(sequelize);
const Project = initProjectModel(sequelize);
const Website = initWebsiteModel(sequelize);
const Feedback = initFeedbackModel(sequelize);
const ActivityLog = initActivityLogModel(sequelize);
const Comment = initCommentModel(sequelize);
const Notification = initNotificationModel(sequelize);
const ApiKey = initApiKeyModel(sequelize);
const Invitation = initInvitationModel(sequelize);
const WebhookDelivery = initWebhookDeliveryModel(sequelize);

// ─── Associations ───

// Workspace ↔ User (through workspace_members)
Workspace.belongsToMany(User, {
  through: WorkspaceMember,
  foreignKey: 'workspace_id',
  otherKey: 'user_id',
});
User.belongsToMany(Workspace, {
  through: WorkspaceMember,
  foreignKey: 'user_id',
  otherKey: 'workspace_id',
});
Workspace.hasMany(WorkspaceMember, { foreignKey: 'workspace_id' });
WorkspaceMember.belongsTo(Workspace, { foreignKey: 'workspace_id' });
User.hasMany(WorkspaceMember, { foreignKey: 'user_id' });
WorkspaceMember.belongsTo(User, { foreignKey: 'user_id' });

// Workspace → Projects
Workspace.hasMany(Project, { foreignKey: 'workspace_id', onDelete: 'CASCADE' });
Project.belongsTo(Workspace, { foreignKey: 'workspace_id' });

// Project → Websites
Project.hasMany(Website, { foreignKey: 'project_id', onDelete: 'CASCADE' });
Website.belongsTo(Project, { foreignKey: 'project_id' });

// Website → Feedback
Website.hasMany(Feedback, { foreignKey: 'website_id', onDelete: 'CASCADE' });
Feedback.belongsTo(Website, { foreignKey: 'website_id' });

// Feedback → ActivityLog
Feedback.hasMany(ActivityLog, { foreignKey: 'feedback_id', onDelete: 'CASCADE' });
ActivityLog.belongsTo(Feedback, { foreignKey: 'feedback_id' });

// Feedback → Comments
Feedback.hasMany(Comment, { foreignKey: 'feedback_id', onDelete: 'CASCADE' });
Comment.belongsTo(Feedback, { foreignKey: 'feedback_id' });

// Feedback ↔ User (assignee, reporter)
Feedback.belongsTo(User, { as: 'assignee', foreignKey: 'assignee_id' });
Feedback.belongsTo(User, { as: 'reporter', foreignKey: 'reporter_id' });

// Feedback → duplicate_of (self-reference)
Feedback.belongsTo(Feedback, { as: 'duplicate', foreignKey: 'duplicate_of' });

// User → Notifications
User.hasMany(Notification, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Notification.belongsTo(User, { foreignKey: 'user_id' });

// Workspace → ApiKeys
Workspace.hasMany(ApiKey, { foreignKey: 'workspace_id', onDelete: 'CASCADE' });
ApiKey.belongsTo(Workspace, { foreignKey: 'workspace_id' });

// Invitations
Workspace.hasMany(Invitation, { foreignKey: 'workspace_id', onDelete: 'CASCADE' });
Invitation.belongsTo(Workspace, { foreignKey: 'workspace_id' });

// ActivityLog → User (actor)
ActivityLog.belongsTo(User, { as: 'actor', foreignKey: 'actor_id' });

// Comment → User
Comment.belongsTo(User, { as: 'author', foreignKey: 'user_id' });

// Workspace → WebhookDeliveries
Workspace.hasMany(WebhookDelivery, { foreignKey: 'workspace_id', onDelete: 'CASCADE' });
WebhookDelivery.belongsTo(Workspace, { foreignKey: 'workspace_id' });

export {
  sequelize,
  Workspace,
  User,
  WorkspaceMember,
  Project,
  Website,
  Feedback,
  ActivityLog,
  Comment,
  Notification,
  ApiKey,
  Invitation,
  WebhookDelivery,
};
