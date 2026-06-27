import { DataTypes } from 'sequelize';

export function initFeedbackModel(sequelize) {
  const Feedback = sequelize.define('Feedback', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    websiteId: {
      type: DataTypes.UUID,
      field: 'website_id',
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(500),
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { notEmpty: true },
    },
    pageUrl: {
      type: DataTypes.TEXT,
      field: 'page_url',
      allowNull: false,
    },
    coordinates: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    screenshot: {
      type: DataTypes.JSONB,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('new', 'open', 'in_progress', 'testing', 'done', 'closed'),
      defaultValue: 'new',
    },
    priority: {
      type: DataTypes.ENUM('critical', 'high', 'medium', 'low'),
      defaultValue: 'medium',
    },
    assigneeId: {
      type: DataTypes.UUID,
      field: 'assignee_id',
    },
    reporterId: {
      type: DataTypes.UUID,
      field: 'reporter_id',
    },
    reporterEmail: {
      type: DataTypes.STRING(255),
      field: 'reporter_email',
    },
    reporterName: {
      type: DataTypes.STRING(255),
      field: 'reporter_name',
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      defaultValue: [],
    },
    duplicateOf: {
      type: DataTypes.UUID,
      field: 'duplicate_of',
    },
    resolvedAt: {
      type: DataTypes.DATE,
      field: 'resolved_at',
    },
    annotations: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
  }, {
    tableName: 'feedback',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['website_id'] },
      { fields: ['status'] },
      { fields: ['assignee_id'] },
      { fields: ['created_at'] },
      { fields: ['page_url'] },
      { fields: ['tags'], using: 'GIN' },
    ],
  });

  return Feedback;
}
