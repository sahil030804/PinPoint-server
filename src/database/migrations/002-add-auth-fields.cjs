'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'token_version', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
    });

    await queryInterface.addColumn('users', 'email_verified_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.addColumn('api_keys', 'key_prefix', {
      type: Sequelize.STRING(16),
      allowNull: true,
    });

    await queryInterface.addIndex('api_keys', ['key_prefix'], { unique: true });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('api_keys', ['key_prefix']);
    await queryInterface.removeColumn('api_keys', 'key_prefix');
    await queryInterface.removeColumn('users', 'email_verified_at');
    await queryInterface.removeColumn('users', 'token_version');
  },
};
