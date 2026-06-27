import { DataTypes } from 'sequelize';

export function initWebsiteModel(sequelize) {
  const Website = sequelize.define('Website', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    projectId: {
      type: DataTypes.UUID,
      field: 'project_id',
      allowNull: false,
    },
    url: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { notEmpty: true },
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      field: 'is_active',
      defaultValue: true,
    },
    widgetConfig: {
      type: DataTypes.JSONB,
      field: 'widget_config',
      defaultValue: {
        position: 'bottom-right',
        color: '#3B82F6',
        buttonText: 'Feedback',
        icon: 'chat',
        darkMode: true,
      },
    },
  }, {
    tableName: 'websites',
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ['project_id'] }],
  });

  return Website;
}
