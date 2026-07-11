'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('webhook_deliveries', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      workspace_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      webhook_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      webhook_url: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      event: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
      },
      response_code: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      response_body: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      duration_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      attempt: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      max_attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 3,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('webhook_deliveries', ['workspace_id']);
    await queryInterface.addIndex('webhook_deliveries', ['webhook_id']);
    await queryInterface.addIndex('webhook_deliveries', ['status']);
    await queryInterface.addIndex('webhook_deliveries', ['created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('webhook_deliveries');
  },
};
