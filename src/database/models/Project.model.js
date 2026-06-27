import { DataTypes } from 'sequelize';

export function initProjectModel(sequelize) {
  const Project = sequelize.define('Project', {
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
    description: {
      type: DataTypes.TEXT,
    },
    color: {
      type: DataTypes.STRING(7),
      defaultValue: '#3B82F6',
    },
  }, {
    tableName: 'projects',
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ['workspace_id'] }],
  });

  return Project;
}
