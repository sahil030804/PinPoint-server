import { DataTypes } from 'sequelize';

export function initNotificationModel(sequelize) {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      field: 'user_id',
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
    },
    link: {
      type: DataTypes.TEXT,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      field: 'is_read',
      defaultValue: false,
    },
  }, {
    tableName: 'notifications',
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [{ fields: ['user_id', 'is_read'] }],
  });

  return Notification;
}
