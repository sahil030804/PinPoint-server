import { DataTypes } from 'sequelize';

export function initInvitationModel(sequelize) {
  const Invitation = sequelize.define('Invitation', {
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
    invitedByUserId: {
      type: DataTypes.UUID,
      field: 'invited_by_user_id',
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING(20),
      defaultValue: 'viewer',
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'pending',
    },
    acceptedAt: {
      type: DataTypes.DATE,
      field: 'accepted_at',
      allowNull: true,
    },
  }, {
    tableName: 'invitations',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['email', 'status'] },
      { fields: ['workspace_id'] },
    ],
  });

  return Invitation;
}
