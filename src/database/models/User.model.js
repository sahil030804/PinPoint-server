import { DataTypes } from 'sequelize';

export function initUserModel(sequelize) {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    name: {
      type: DataTypes.STRING(255),
    },
    avatarUrl: {
      type: DataTypes.TEXT,
      field: 'avatar_url',
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      field: 'password_hash',
    },
    tokenVersion: {
      type: DataTypes.INTEGER,
      field: 'token_version',
      defaultValue: 0,
      allowNull: false,
    },
    emailVerifiedAt: {
      type: DataTypes.DATE,
      field: 'email_verified_at',
      allowNull: true,
    },
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
  });

  return User;
}
