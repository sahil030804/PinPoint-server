'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('workspaces', 'plan', {
      type: Sequelize.STRING(20),
      defaultValue: 'free',
      allowNull: false,
    });

    await queryInterface.addColumn('workspaces', 'feedback_monthly_count', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
    });

    await queryInterface.addColumn('workspaces', 'feedback_limit_reset_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addIndex('workspaces', ['plan']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('workspaces', 'plan');
    await queryInterface.removeColumn('workspaces', 'feedback_monthly_count');
    await queryInterface.removeColumn('workspaces', 'feedback_limit_reset_at');
  },
};
