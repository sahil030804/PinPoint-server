import { DataTypes } from 'sequelize';

export function initCommentModel(sequelize) {
  const Comment = sequelize.define('Comment', {
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
    userId: {
      type: DataTypes.UUID,
      field: 'user_id',
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { notEmpty: true },
    },
  }, {
    tableName: 'comments',
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ['feedback_id'] }],
  });

  return Comment;
}
