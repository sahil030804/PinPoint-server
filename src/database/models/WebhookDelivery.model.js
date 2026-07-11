import { DataTypes } from 'sequelize';

export function initWebhookDeliveryModel(sequelize) {
  const WebhookDelivery = sequelize.define('WebhookDelivery', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    workspaceId: {
      type: DataTypes.UUID,
      field: 'workspace_id',
      allowNull: false,
    },
    webhookId: {
      type: DataTypes.UUID,
      field: 'webhook_id',
      allowNull: false,
    },
    webhookUrl: {
      type: DataTypes.TEXT,
      field: 'webhook_url',
      allowNull: false,
    },
    event: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
    },
    responseCode: {
      type: DataTypes.INTEGER,
      field: 'response_code',
      allowNull: true,
    },
    responseBody: {
      type: DataTypes.TEXT,
      field: 'response_body',
      allowNull: true,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    durationMs: {
      type: DataTypes.INTEGER,
      field: 'duration_ms',
      allowNull: true,
    },
    attempt: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    maxAttempts: {
      type: DataTypes.INTEGER,
      field: 'max_attempts',
      allowNull: false,
      defaultValue: 3,
    },
  }, {
    tableName: 'webhook_deliveries',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ['workspace_id'] },
      { fields: ['webhook_id'] },
      { fields: ['status'] },
      { fields: ['created_at'] },
    ],
  });

  return WebhookDelivery;
}
