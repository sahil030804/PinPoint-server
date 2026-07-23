import { DataTypes } from 'sequelize';

export function initApiKeyModel(sequelize) {
  const ApiKey = sequelize.define('ApiKey', {
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { notEmpty: true },
    },
    keyHash: {
      type: DataTypes.STRING(255),
      field: 'key_hash',
      allowNull: false,
    },
    keyPrefix: {
      type: DataTypes.STRING(16),
      field: 'key_prefix',
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING(20),
      defaultValue: 'developer',
      validate: { isIn: [['owner', 'admin', 'developer', 'viewer', 'client']] },
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      field: 'last_used_at',
    },
    expiresAt: {
      type: DataTypes.DATE,
      field: 'expires_at',
    },
  }, {
    tableName: 'api_keys',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['workspace_id'] },
      { fields: ['key_prefix'], unique: true },
    ],
  });

  return ApiKey;
}
