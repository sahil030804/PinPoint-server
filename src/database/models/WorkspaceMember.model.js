import { DataTypes } from 'sequelize';

export function initWorkspaceMemberModel(sequelize) {
  const WorkspaceMember = sequelize.define('WorkspaceMember', {
    workspaceId: {
      type: DataTypes.UUID,
      field: 'workspace_id',
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      field: 'user_id',
      primaryKey: true,
    },
    role: {
      type: DataTypes.ENUM('owner', 'admin', 'developer', 'viewer', 'client'),
      defaultValue: 'viewer',
      allowNull: false,
    },
    joinedAt: {
      type: DataTypes.DATE,
      field: 'joined_at',
      defaultValue: DataTypes.NOW,
    },
  }, {
    tableName: 'workspace_members',
    timestamps: false,
    underscored: true,
  });

  return WorkspaceMember;
}
