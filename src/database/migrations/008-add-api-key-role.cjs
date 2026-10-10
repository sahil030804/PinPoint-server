'use strict';

/** Adds the API-key role column (and missing updated_at) introduced on the epic branch. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('api_keys', 'role', {
      type: Sequelize.STRING(20),
      allowNull: true,
      defaultValue: 'developer',
    });
    await queryInterface.addColumn('api_keys', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    // Backfill existing rows, then enforce NOT NULL to match the model default.
    await queryInterface.sequelize.query(
      `UPDATE api_keys SET role = 'developer' WHERE role IS NULL`
    );
    await queryInterface.changeColumn('api_keys', 'role', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'developer',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('api_keys', 'role');
    await queryInterface.removeColumn('api_keys', 'updated_at');
  },
};
