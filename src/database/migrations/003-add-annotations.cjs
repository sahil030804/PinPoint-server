'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('feedback', 'annotations', {
      type: Sequelize.JSONB,
      defaultValue: [],
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('feedback', 'annotations');
  },
};
