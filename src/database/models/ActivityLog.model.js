import { DataTypes } from 'sequelize';

export function initActivityLogModel(sequelize) {
  const ActivityLog = sequelize.define('ActivityLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    feedbackId: {
      type: DataTypes.UUID,
      field: 'feedback_id',
      allowNull: false,
    },
    actorId: {
      type: DataTypes.UUID,
      field: 'actor_id',
    },
    action: {
      type: DataTypes.ENUM(
        'created', 'assigned', 'unassigned', 'status_changed', 'priority_changed',
        'comment_added', 'resolved', 'reopened', 'tag_added', 'tag_removed',
        'duplicate_marked', 'screenshot_updated'
      ),
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  }, {
    tableName: 'activity_logs',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['feedback_id'] },
      { fields: ['created_at'] },
    ],
  });

  return ActivityLog;
}
