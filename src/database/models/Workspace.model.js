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
