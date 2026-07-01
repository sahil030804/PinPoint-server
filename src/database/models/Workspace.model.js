import { DataTypes } from 'sequelize';

export function initWorkspaceModel(sequelize) {
  const Workspace = sequelize.define('Workspace', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
    logoUrl: {
      type: DataTypes.TEXT,
      field: 'logo_url',
    },
    plan: {
      type: DataTypes.STRING(20),
      defaultValue: 'free',
      allowNull: false,
    },
    feedbackMonthlyCount: {
      type: DataTypes.INTEGER,
      field: 'feedback_monthly_count',
      defaultValue: 0,
      allowNull: false,
    },
    feedbackLimitResetAt: {
      type: DataTypes.DATE,
      field: 'feedback_limit_reset_at',
      allowNull: true,
    },
    theme: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  }, {
    tableName: 'workspaces',
    timestamps: true,
    underscored: true,
  });

  return Workspace;
}
